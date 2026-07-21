// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

struct PythPrice {
    int64 price;
    uint64 conf;
    int32 expo;
    uint256 publishTime;
}

interface IPyth {
    function updatePriceFeeds(bytes[] calldata updateData) external payable;
    function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (PythPrice memory price);
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256 feeAmount);
}

/**
 * @title ShitMarketCore
 * @notice Core Prediction Market smart contract migrated from Solana to Avalanche.
 * Wagering is denominated in USDC (6 decimals), matching the Solana USDC scale.
 */
contract ShitMarketCore is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Enums & Constants ──────────────────────────────────────────────────
    
    enum Side { Moon, Jeet, Draw }
    enum RoomStatus { Active, Settled, Disputed }

    uint256 public constant MAX_FEE_BPS = 1000; // Max fee 10%
    uint256 public constant BPS_DIVISOR = 10000;
    uint256 public constant CHALLENGE_WINDOW_SECONDS = 3600; // 1 hour dispute window
    uint256 public constant DISPUTE_BOND_AMOUNT = 10 * 10**6; // 10 USDC bond for disputing

    // ─── Structures ──────────────────────────────────────────────────────────

    struct PlatformConfig {
        address treasury;
        address keeper;
        uint16 platformFeeBps; // e.g., 100 = 1%
        uint256 minimumLiquidity; // Minimum total pool (in USDC) to settle two-sided rooms
        uint256 twapWindowSeconds;
        uint256 coolingOffSeconds;
        bool paused;
    }

    struct Room {
        bytes32 roomId;
        bytes32 tokenMint;        // Base58 Solana mint or EVM address padded to bytes32
        bytes32 tokenName;        // 32-byte representation
        string chainId;           // e.g. "solana", "base", "avalanche"
        int64 openingPrice;       // Price scaled to 6 decimals ($1.00 = 1_000_000)
        uint256 openingTimestamp;
        uint256 expiryTimestamp;
        uint256 settlementTimestamp;
        uint256 durationMinutes;
        uint256 moonPool;
        uint256 jeetPool;
        int64 finalPrice;
        int64 twapFinalPrice;
        Side winner;
        RoomStatus status;
        address creator;
        address oracle;
        uint256 oracleFeeAmount;
        uint8 twapSampleCount;
        int64[10] twapSamples;    // Observed prices
        uint256[10] twapSampleTimestamps;
        uint8 disputeStatus;      // 0 = None, 1 = Overturned
        address disputeChallenger;
        uint256 disputeBond;
    }

    struct Bet {
        bytes32 roomId;
        address user;
        address currentOwner;    // Owner of the position (differs from user if sold)
        Side side;
        uint256 amount;
        bool claimed;
    }

    struct Listing {
        bytes32 listingId;
        bytes32 betId;
        address seller;
        uint256 price;
        bool active;
    }

    struct ReferralState {
        address referrer;
        uint256 accumulatedRewards;
    }

    // ─── State Variables ────────────────────────────────────────────────────

    IERC20 public immutable usdcToken;
    PlatformConfig public config;
    address public pythOracle;

    mapping(bytes32 => Room) internal rooms;
    mapping(bytes32 => Bet) public bets;
    mapping(bytes32 => Listing) public listings;
    
    mapping(address => address) public userReferrals; // user -> referrer
    mapping(address => ReferralState) public referralRewards; // referrer -> rewards data
    
    uint256 public accumulatedPlatformFees;
    uint256 public totalUSDCInEscrow; // Tracks active betting pools and dispute bonds

    // ─── Events ─────────────────────────────────────────────────────────────

    event RoomCreated(
        bytes32 indexed roomId,
        address indexed creator,
        bytes32 tokenMint,
        string tokenName,
        string chainId,
        int64 openingPrice,
        uint256 expiryTimestamp,
        address oracle,
        uint256 oracleFeeAmount
    );

    event BetPlaced(
        bytes32 indexed roomId,
        address indexed user,
        uint8 side, // 0 = Moon, 1 = Jeet
        uint256 amount,
        uint256 moonPool,
        uint256 jeetPool
    );

    event RoomSettled(
        bytes32 indexed roomId,
        uint8 winner, // 0 = Moon, 1 = Jeet, 2 = Draw
        int64 finalPrice,
        int64 twapFinalPrice,
        uint256 totalPool,
        uint256 platformFee
    );

    event RoomVoided(
        bytes32 indexed roomId,
        uint256 totalRefundPool,
        string reason
    );

    event WinningsClaimed(
        bytes32 indexed roomId,
        address indexed user,
        uint256 payout
    );

    event PositionListed(
        bytes32 indexed listingId,
        bytes32 indexed betId,
        address indexed seller,
        uint256 price
    );

    event ListingCancelled(
        bytes32 indexed listingId,
        bytes32 indexed betId,
        address indexed seller
    );

    event PositionBought(
        bytes32 indexed listingId,
        bytes32 indexed betId,
        address indexed buyer,
        address seller,
        uint256 price
    );

    event RoomDisputed(
        bytes32 indexed roomId,
        address indexed challenger,
        uint256 disputeBond
    );

    event DisputeResolved(
        bytes32 indexed roomId,
        uint8 winner,
        bool refundChallenger
    );

    event ReferralRegistered(address indexed user, address indexed referrer);
    event ReferralRewardsClaimed(address indexed referrer, uint256 amount);

    // ─── Modifiers ──────────────────────────────────────────────────────────

    modifier whenNotPaused() {
        require(!config.paused, "Platform is paused");
        _;
    }

    modifier onlyKeeper() {
        require(msg.sender == config.keeper, "Only keeper authorized");
        _;
    }

    // ─── Constructor ────────────────────────────────────────────────────────

    constructor(address _usdcToken, address _treasury, uint16 _platformFeeBps) Ownable(msg.sender) {
        require(_usdcToken != address(0), "Invalid USDC token");
        require(_treasury != address(0), "Invalid treasury");
        require(_platformFeeBps <= MAX_FEE_BPS, "Fee too high");

        usdcToken = IERC20(_usdcToken);

        config = PlatformConfig({
            treasury: _treasury,
            keeper: msg.sender,
            platformFeeBps: _platformFeeBps,
            minimumLiquidity: 10 * 10**6, // 10 USDC min pool
            twapWindowSeconds: 300,        // 5 minute default window
            coolingOffSeconds: 14 days,
            paused: false
        });
    }

    // ─── External Write Functions ───────────────────────────────────────────

    /**
     * @notice Initialize/Update Configuration
     */
    function updateConfig(
        address _treasury,
        address _keeper,
        uint16 _platformFeeBps,
        uint256 _minimumLiquidity,
        uint256 _twapWindowSeconds,
        uint256 _coolingOffSeconds
    ) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        require(_keeper != address(0), "Invalid keeper");
        require(_platformFeeBps <= MAX_FEE_BPS, "Fee too high");

        config.treasury = _treasury;
        config.keeper = _keeper;
        config.platformFeeBps = _platformFeeBps;
        config.minimumLiquidity = _minimumLiquidity;
        config.twapWindowSeconds = _twapWindowSeconds;
        config.coolingOffSeconds = _coolingOffSeconds;
    }

    /**
     * @notice Pause / Unpause the platform
     */
    function setPaused(bool _paused) external onlyOwner {
        config.paused = _paused;
    }

    /**
     * @notice Configure Pyth Oracle Contract Address
     */
    function setPythOracle(address _pythOracle) external onlyOwner {
        require(_pythOracle != address(0), "Invalid Pyth oracle address");
        pythOracle = _pythOracle;
    }

    /**
     * @notice Register a referrer for a user
     */
    function registerReferral(address _referrer) external whenNotPaused {
        require(_referrer != address(0), "Invalid referrer");
        require(_referrer != msg.sender, "Cannot refer self");
        require(userReferrals[msg.sender] == address(0), "Referral already registered");

        userReferrals[msg.sender] = _referrer;
        if (referralRewards[_referrer].referrer == address(0)) {
            referralRewards[_referrer].referrer = _referrer;
        }

        emit ReferralRegistered(msg.sender, _referrer);
    }

    /**
     * @notice Create a new prediction room for a token
     */
    function createRoom(
        bytes32 _tokenMint,
        string calldata _tokenName,
        string calldata _chainId,
        uint256 _durationMinutes,
        int64 _openingPrice,
        address _oracle,
        uint256 _oracleFeeAmount
    ) external whenNotPaused returns (bytes32) {
        require(_durationMinutes <= 525600, "Duration exceeds one year");
        
        bytes32 roomId = keccak256(
            abi.encodePacked(_tokenMint, msg.sender, _durationMinutes, block.timestamp)
        );
        require(rooms[roomId].roomId == bytes32(0), "Room ID collision");

        Room storage room = rooms[roomId];
        room.roomId = roomId;
        room.tokenMint = _tokenMint;
        
        // Save name truncated/padded to 32 bytes
        bytes32 nameBytes;
        bytes memory tempName = bytes(_tokenName);
        assembly {
            nameBytes := mload(add(tempName, 32))
        }
        room.tokenName = nameBytes;
        room.chainId = _chainId;
        room.openingPrice = _openingPrice;
        room.openingTimestamp = block.timestamp;
        room.expiryTimestamp = block.timestamp + (_durationMinutes * 1 minutes);
        room.durationMinutes = _durationMinutes;
        room.status = RoomStatus.Active;
        room.creator = msg.sender;
        room.oracle = _oracle == address(0) ? config.keeper : _oracle;
        room.oracleFeeAmount = _oracleFeeAmount;

        emit RoomCreated(
            roomId,
            msg.sender,
            _tokenMint,
            _tokenName,
            _chainId,
            _openingPrice,
            room.expiryTimestamp,
            room.oracle,
            _oracleFeeAmount
        );

        return roomId;
    }

    /**
     * @notice Place bet on Moon or Jeet
     */
    function placeBet(bytes32 _roomId, Side _side, uint256 _amount) external whenNotPaused nonReentrant {
        require(_amount > 0, "Bet amount must be positive");
        require(_side == Side.Moon || _side == Side.Jeet, "Invalid side");

        Room storage room = rooms[_roomId];
        require(room.roomId != bytes32(0), "Room does not exist");
        require(room.status == RoomStatus.Active, "Room not active");
        require(block.timestamp < room.expiryTimestamp, "Room expired");

        // Transfer USDC from user to contract
        usdcToken.safeTransferFrom(msg.sender, address(this), _amount);
        totalUSDCInEscrow += _amount;

        bytes32 betId = keccak256(abi.encodePacked(_roomId, msg.sender, _side));
        Bet storage bet = bets[betId];

        if (bet.roomId == bytes32(0)) {
            // New bet initialization
            bet.roomId = _roomId;
            bet.user = msg.sender;
            bet.currentOwner = msg.sender;
            bet.side = _side;
            bet.amount = _amount;
            bet.claimed = false;
        } else {
            // Increase existing bet size
            require(bet.currentOwner == msg.sender, "Unauthorized bet account access");
            bet.amount += _amount;
        }

        if (_side == Side.Moon) {
            room.moonPool += _amount;
        } else {
            room.jeetPool += _amount;
        }

        emit BetPlaced(
            _roomId,
            msg.sender,
            uint8(_side),
            _amount,
            room.moonPool,
            room.jeetPool
        );
    }

    /**
     * @notice Record TWAP Price Sample (called by keeper during active room window)
     */
    function recordTwap(bytes32 _roomId, int64 _price) external onlyKeeper whenNotPaused {
        Room storage room = rooms[_roomId];
        require(room.status == RoomStatus.Active, "Room not active");
        require(block.timestamp < room.expiryTimestamp, "Room expired");

        uint8 idx = room.twapSampleCount % 10;
        room.twapSamples[idx] = _price;
        room.twapSampleTimestamps[idx] = block.timestamp;
        room.twapSampleCount++;
    }

    /**
     * @notice Settle Prediction Room after expiry via Keeper
     */
    function settleRoom(bytes32 _roomId, int64 _finalPriceParam) external onlyKeeper whenNotPaused nonReentrant {
        _internalSettleRoom(_roomId, _finalPriceParam);
    }

    /**
     * @notice Settle Prediction Room using Cryptographically Verified Pyth On-Chain Price Update
     */
    function settleRoomWithPyth(
        bytes32 _roomId,
        bytes[] calldata _priceUpdateData,
        bytes32 _pythFeedId
    ) external payable whenNotPaused nonReentrant {
        require(pythOracle != address(0), "Pyth oracle not configured");

        IPyth pyth = IPyth(pythOracle);
        uint256 fee = pyth.getUpdateFee(_priceUpdateData);
        require(msg.value >= fee, "Insufficient fee for Pyth update");

        pyth.updatePriceFeeds{value: fee}(_priceUpdateData);

        PythPrice memory priceStruct = pyth.getPriceNoOlderThan(_pythFeedId, 600);
        require(priceStruct.price > 0, "Invalid Pyth price");

        // Scale Pyth price to 6 decimals (standardized int64 format)
        int64 scaledPrice;
        if (priceStruct.expo < -6) {
            scaledPrice = priceStruct.price / int64(int256(10 ** (uint32(-priceStruct.expo - 6))));
        } else if (priceStruct.expo > -6) {
            scaledPrice = priceStruct.price * int64(int256(10 ** (uint32(6 + priceStruct.expo))));
        } else {
            scaledPrice = priceStruct.price;
        }

        _internalSettleRoom(_roomId, scaledPrice);
    }

    function _internalSettleRoom(bytes32 _roomId, int64 _finalPriceParam) internal {
        Room storage room = rooms[_roomId];
        require(room.roomId != bytes32(0), "Room does not exist");
        require(room.status == RoomStatus.Active, "Room already settled");
        require(block.timestamp >= room.expiryTimestamp, "Room not expired yet");

        // ─── ONE-SIDED ROOM VOID: If one pool is empty, void the room ───
        if (room.moonPool == 0 || room.jeetPool == 0) {
            room.status = RoomStatus.Settled;
            room.winner = Side.Draw;
            room.finalPrice = room.openingPrice;
            room.twapFinalPrice = room.openingPrice;

            emit RoomVoided(_roomId, room.moonPool + room.jeetPool, "One-sided room: no opposing bets.");
            return;
        }

        // ─── MINIMUM LIQUIDITY CHECK ───
        uint256 totalPool = room.moonPool + room.jeetPool;
        if (totalPool < config.minimumLiquidity) {
            room.status = RoomStatus.Settled;
            room.winner = Side.Draw;
            room.finalPrice = room.openingPrice;
            room.twapFinalPrice = room.openingPrice;

            emit RoomVoided(_roomId, totalPool, "Insufficient room liquidity.");
            return;
        }

        // Determine winner
        Side roomWinner = Side.Draw;
        if (_finalPriceParam > room.openingPrice) {
            roomWinner = Side.Moon;
        } else if (_finalPriceParam < room.openingPrice) {
            roomWinner = Side.Jeet;
        }

        // Compute TWAP Price (or default to raw final price if insufficient samples)
        int64 twapFinal = computeTwapPrice(room, _finalPriceParam);
        room.twapFinalPrice = twapFinal;

        // Calculate and deduct platform fee
        uint256 platformFee = (totalPool * config.platformFeeBps) / BPS_DIVISOR;
        if (platformFee > 0) {
            accumulatedPlatformFees += platformFee;
            totalUSDCInEscrow -= platformFee;
        }

        // Deduct and payout oracle fee
        uint256 oracleFee = room.oracleFeeAmount;
        if (oracleFee > 0 && oracleFee <= totalPool - platformFee) {
            totalUSDCInEscrow -= oracleFee;
            usdcToken.safeTransfer(room.oracle, oracleFee);
        }

        room.settlementTimestamp = block.timestamp;
        room.status = RoomStatus.Settled;
        room.winner = roomWinner;
        room.finalPrice = _finalPriceParam;

        emit RoomSettled(
            _roomId,
            uint8(roomWinner),
            _finalPriceParam,
            twapFinal,
            totalPool,
            platformFee
        );
    }

    /**
     * @notice Claim Winnings / Refund from Settled Room
     */
    function claimWinnings(bytes32 _roomId, Side _side) external whenNotPaused nonReentrant {
        Room storage room = rooms[_roomId];
        require(room.status == RoomStatus.Settled, "Room not settled yet");

        bytes32 betId = keccak256(abi.encodePacked(_roomId, msg.sender, _side));
        Bet storage bet = bets[betId];
        require(bet.roomId != bytes32(0), "No wager found");
        require(bet.currentOwner == msg.sender, "Unauthorized claim call");
        require(!bet.claimed, "Winnings already claimed");

        uint256 totalPool = room.moonPool + room.jeetPool;
        uint256 platformFee = (room.winner == Side.Draw) ? 0 : (totalPool * config.platformFeeBps) / BPS_DIVISOR;
        uint256 oracleFee = (room.winner == Side.Draw) ? 0 : room.oracleFeeAmount;

        uint256 totalPayoutPool = totalPool - platformFee - oracleFee;
        uint256 payoutAmount = 0;

        if (room.winner == Side.Draw) {
            // Draw/Void path: return 100% of the player's stake
            payoutAmount = bet.amount;
        } else {
            require(bet.side == room.winner, "Only winning side can claim");
            uint256 winningPool = (room.winner == Side.Moon) ? room.moonPool : room.jeetPool;
            payoutAmount = (bet.amount * totalPayoutPool) / winningPool;
        }

        // Reentrancy guard: set claimed flag prior to transfer
        bet.claimed = true;
        totalUSDCInEscrow -= payoutAmount;

        // Referral reward distribution (0.1% of payout to referrer)
        address referrer = userReferrals[msg.sender];
        if (referrer != address(0) && payoutAmount > 1000) {
            uint256 referralReward = payoutAmount / 1000;
            payoutAmount -= referralReward;
            referralRewards[referrer].accumulatedRewards += referralReward;
        }

        usdcToken.safeTransfer(msg.sender, payoutAmount);
        emit WinningsClaimed(_roomId, msg.sender, payoutAmount);
    }

    /**
     * @notice Dispute / Challenge a settled prediction room verdict
     */
    function disputeRoom(bytes32 _roomId) external whenNotPaused nonReentrant {
        Room storage room = rooms[_roomId];
        require(room.status == RoomStatus.Settled, "Room not settled");
        require(
            block.timestamp <= room.settlementTimestamp + CHALLENGE_WINDOW_SECONDS,
            "Dispute period expired"
        );

        // Lock dispute bond from challenger
        usdcToken.safeTransferFrom(msg.sender, address(this), DISPUTE_BOND_AMOUNT);
        totalUSDCInEscrow += DISPUTE_BOND_AMOUNT;

        room.status = RoomStatus.Disputed;
        room.disputeChallenger = msg.sender;
        room.disputeBond = DISPUTE_BOND_AMOUNT;

        emit RoomDisputed(_roomId, msg.sender, DISPUTE_BOND_AMOUNT);
    }

    /**
     * @notice Resolve dispute (Admin only)
     */
    function resolveDispute(
        bytes32 _roomId,
        Side _winner,
        bool _overturned
    ) external onlyOwner nonReentrant {
        Room storage room = rooms[_roomId];
        require(room.status == RoomStatus.Disputed, "Room is not disputed");

        uint256 bond = room.disputeBond;
        room.disputeBond = 0;

        if (_overturned) {
            // Refund challenger their bond
            totalUSDCInEscrow -= bond;
            usdcToken.safeTransfer(room.disputeChallenger, bond);
            room.disputeStatus = 1; // Overturned
        } else {
            // Slash challenger: Add bond to platform treasury fees
            totalUSDCInEscrow -= bond;
            accumulatedPlatformFees += bond;
            room.disputeStatus = 0; // Dismissed
        }

        room.winner = _winner;
        room.status = RoomStatus.Settled;
        room.settlementTimestamp = block.timestamp; // Reset settlement time to allow withdrawals

        emit DisputeResolved(_roomId, uint8(_winner), _overturned);
    }

    // ─── Secondary Market / Positions Marketplace ───────────────────────

    /**
     * @notice List a prediction ticket position for sale
     */
    function listPosition(bytes32 _roomId, Side _side, uint256 _price) external whenNotPaused {
        Room storage room = rooms[_roomId];
        require(room.status == RoomStatus.Active, "Room not active");
        require(block.timestamp < room.expiryTimestamp, "Room expired");

        bytes32 betId = keccak256(abi.encodePacked(_roomId, msg.sender, _side));
        Bet storage bet = bets[betId];
        require(bet.roomId != bytes32(0), "Wager does not exist");
        require(bet.currentOwner == msg.sender, "Only owner can list position");
        require(!bet.claimed, "Position already claimed");

        bytes32 listingId = keccak256(abi.encodePacked(_roomId, betId));
        Listing storage listing = listings[listingId];
        require(!listing.active, "Listing already active");

        listing.listingId = listingId;
        listing.betId = betId;
        listing.seller = msg.sender;
        listing.price = _price;
        listing.active = true;

        emit PositionListed(listingId, betId, msg.sender, _price);
    }

    /**
     * @notice Cancel position listing
     */
    function cancelListing(bytes32 _listingId) external whenNotPaused {
        Listing storage listing = listings[_listingId];
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender, "Unauthorized cancel");

        listing.active = false;
        emit ListingCancelled(_listingId, listing.betId, msg.sender);
    }

    /**
     * @notice Buy a listed prediction ticket position
     */
    function buyPosition(bytes32 _listingId) external whenNotPaused nonReentrant {
        Listing storage listing = listings[_listingId];
        require(listing.active, "Listing not active");

        Bet storage bet = bets[listing.betId];
        Room storage room = rooms[bet.roomId];
        require(room.status == RoomStatus.Active, "Room not active");
        require(block.timestamp < room.expiryTimestamp, "Room expired");

        address seller = listing.seller;
        uint256 price = listing.price;

        listing.active = false;

        // Trade fee (1% fee charged to trade volume, sent to platform treasury)
        uint256 tradeFee = price / 100;
        uint256 netPayout = price - tradeFee;

        // Execute transactions
        usdcToken.safeTransferFrom(msg.sender, seller, netPayout);
        if (tradeFee > 0) {
            usdcToken.safeTransferFrom(msg.sender, address(this), tradeFee);
            accumulatedPlatformFees += tradeFee;
        }

        // Change position owner to buyer
        bet.currentOwner = msg.sender;

        emit PositionBought(_listingId, listing.betId, msg.sender, seller, price);
    }

    // ─── Referral and Fee Admin Actions ──────────────────────────────────

    /**
     * @notice Claim accrued referral rewards
     */
    function claimReferralRewards() external nonReentrant {
        uint256 amount = referralRewards[msg.sender].accumulatedRewards;
        require(amount > 0, "No rewards to claim");

        referralRewards[msg.sender].accumulatedRewards = 0;
        usdcToken.safeTransfer(msg.sender, amount);

        emit ReferralRewardsClaimed(msg.sender, amount);
    }

    /**
     * @notice Withdraw platform fees accumulated from settlements/marketplace
     */
    function withdrawPlatformFees() external onlyOwner nonReentrant {
        uint256 amount = accumulatedPlatformFees;
        require(amount > 0, "No fees to withdraw");

        accumulatedPlatformFees = 0;
        usdcToken.safeTransfer(config.treasury, amount);
    }

    /**
     * @notice Admin-only escape hatch: sweep unclaimed funds from highly stale rooms
     */
    function sweepEscrow(bytes32 _roomId, address _receiver) external onlyOwner nonReentrant {
        Room storage room = rooms[_roomId];
        require(room.status == RoomStatus.Settled, "Room not settled yet");
        require(
            block.timestamp >= room.expiryTimestamp + config.coolingOffSeconds,
            "Cooling-off period still active"
        );
        require(_receiver != address(0), "Invalid receiver");

        uint256 roomTotal = room.moonPool + room.jeetPool;
        // Basic sweep of the remaining pool size to avoid locking dust or unclaimed winnings forever
        // Calculate what remains of this room's deposits (simplified for total contract balance safety)
        uint256 balance = usdcToken.balanceOf(address(this));
        uint256 sweepAmount = balance > totalUSDCInEscrow ? balance - totalUSDCInEscrow : 0;
        if (sweepAmount > roomTotal) {
            sweepAmount = roomTotal;
        }

        if (sweepAmount > 0) {
            usdcToken.safeTransfer(_receiver, sweepAmount);
        }
    }

    // ─── Internal & View Functions ──────────────────────────────────────────

    /**
     * @dev Calculates TWAP from stored price samples. If samples are empty, defaults to raw price.
     */
    function computeTwapPrice(Room storage _room, int64 _finalPrice) internal view returns (int64) {
        if (_room.twapSampleCount == 0) {
            return _finalPrice;
        }

        int256 weightedSum = 0;
        uint256 totalWeight = 0;
        uint256 count = _room.twapSampleCount > 10 ? 10 : _room.twapSampleCount;

        for (uint256 i = 0; i < count; i++) {
            int64 price = _room.twapSamples[i];
            uint256 ts = _room.twapSampleTimestamps[i];
            
            // Weight is duration in seconds since sample observation to next sample or settlement
            uint256 nextTs = (i < count - 1) ? _room.twapSampleTimestamps[i + 1] : block.timestamp;
            uint256 duration = nextTs - ts;

            if (duration > 0) {
                weightedSum += int256(price) * int256(duration);
                totalWeight += duration;
            }
        }

        if (totalWeight == 0) {
            return _finalPrice;
        }

        return int64(weightedSum / int256(totalWeight));
    }

    /**
     * @notice Get room details
     */
    function getRoom(bytes32 _roomId) external view returns (Room memory) {
        return rooms[_roomId];
    }
}
