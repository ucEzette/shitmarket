// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IOracle {
    /**
     * @notice Get outcome index reported by the oracle.
     * @return ready Whether the oracle has resolved the market.
     * @return outcomeIndex Index of the resolved outcome.
     */
    function getOutcome(uint256 marketId) external view returns (bool ready, uint256 outcomeIndex);
}

/**
 * @title OracleRegistry
 * @notice Aggregates different oracle types (Self-Sovereign, Staking-based, Programmatic, AI opML)
 * and governs the dispute escalation/meta-arbitration layer.
 */
contract OracleRegistry is Ownable, ReentrancyGuard, IOracle {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;

    enum OracleType { SelfSovereign, StakingBased, Programmatic, AiML }
    
    struct OracleNode {
        uint256 stakedAmount;
        uint256 marketsResolved;
        uint256 disputesLost;
        bool active;
    }

    struct OracleConfig {
        OracleType oracleType;
        address creator;
        string metadata; // IPFS hash or programmatic ABI definition
    }

    struct OutcomeReport {
        uint256 outcomeIndex;
        uint256 reportedTime;
        address reporter;
        bool disputed;
        address challenger;
        uint256 disputeBond;
        bool finalized;
    }

    // Node Staking configs
    uint256 public constant MINIMUM_STAKE = 100 * 10**6; // 100 USDC minimum stake to resolve markets
    uint256 public constant CHALLENGE_PERIOD = 1 days;   // 24 hour challenge period
    uint256 public constant DISPUTE_BOND = 50 * 10**6;    // 50 USDC dispute bond

    // oracleAddress => config
    mapping(address => OracleConfig) public oracles;
    // validatorAddress => node info
    mapping(address => OracleNode) public validators;
    // marketId => outcome report
    mapping(uint256 => OutcomeReport) public reports;
    // marketId => custom self-sovereign resolver address
    mapping(uint256 => address) public customResolvers;

    event OracleRegistered(address indexed oracleAddress, OracleType indexed oracleType, address creator);
    event ValidatorStaked(address indexed validator, uint256 amount);
    event ValidatorUnstaked(address indexed validator, uint256 amount);
    event OutcomeReported(uint256 indexed marketId, address indexed reporter, uint256 outcomeIndex);
    event OutcomeChallenged(uint256 indexed marketId, address indexed challenger, uint256 outcomeIndex, uint256 bondAmount);
    event DisputeSettled(uint256 indexed marketId, uint256 finalOutcomeIndex, bool overturned);

    constructor(address _usdcToken) Ownable(msg.sender) {
        require(_usdcToken != address(0), "Invalid USDC");
        usdcToken = IERC20(_usdcToken);
    }

    /**
     * @notice Register a custom oracle address and type.
     */
    function registerOracle(address oracleAddress, OracleType oracleType, string calldata metadata) external {
        require(oracleAddress != address(0), "Invalid oracle address");
        require(oracles[oracleAddress].creator == address(0), "Oracle already registered");

        oracles[oracleAddress] = OracleConfig({
            oracleType: oracleType,
            creator: msg.sender,
            metadata: metadata
        });

        emit OracleRegistered(oracleAddress, oracleType, msg.sender);
    }

    /**
     * @notice Staking-based validator node onboarding.
     */
    function stakeValidator(uint256 amount) external nonReentrant {
        require(amount >= MINIMUM_STAKE, "Stake below minimum");
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);

        validators[msg.sender].stakedAmount += amount;
        validators[msg.sender].active = true;

        emit ValidatorStaked(msg.sender, amount);
    }

    /**
     * @notice Unstake validator tokens (only if inactive and not in pending dispute).
     */
    function unstakeValidator(uint256 amount) external nonReentrant {
        require(validators[msg.sender].stakedAmount >= amount, "Insufficient stake");
        validators[msg.sender].stakedAmount -= amount;
        
        if (validators[msg.sender].stakedAmount < MINIMUM_STAKE) {
            validators[msg.sender].active = false;
        }

        usdcToken.safeTransfer(msg.sender, amount);
        emit ValidatorUnstaked(msg.sender, amount);
    }

    /**
     * @notice Set custom self-sovereign resolver EOA for a specific market (called by MarketFactory).
     */
    function setCustomResolver(uint256 marketId, address resolver) external {
        require(customResolvers[marketId] == address(0), "Resolver already set");
        customResolvers[marketId] = resolver;
    }

    /**
     * @notice Report outcome for a market.
     * Accessible by:
     * - Designated EOA for Self-Sovereign markets.
     * - Staked validators for Staking-Based markets.
     * - Anyone for AI opML markets (acting as AI solver nodes).
     */
    function reportOutcome(uint256 marketId, uint256 outcomeIndex) external nonReentrant {
        require(reports[marketId].reportedTime == 0, "Outcome already reported");

        address customResolver = customResolvers[marketId];
        if (customResolver != address(0)) {
            // Self-sovereign verification
            require(msg.sender == customResolver, "Not the designated resolver");
        } else {
            // Staking-based validator verification
            require(validators[msg.sender].active, "Validator not active");
            require(validators[msg.sender].stakedAmount >= MINIMUM_STAKE, "Insufficient validator stake");
        }

        reports[marketId] = OutcomeReport({
            outcomeIndex: outcomeIndex,
            reportedTime: block.timestamp,
            reporter: msg.sender,
            disputed: false,
            challenger: address(0),
            disputeBond: 0,
            finalized: false
        });

        emit OutcomeReported(marketId, msg.sender, outcomeIndex);
    }

    /**
     * @notice Challenge a reported outcome within the challenge window by locking a bond.
     */
    function challengeOutcome(uint256 marketId) external nonReentrant {
        OutcomeReport storage report = reports[marketId];
        require(report.reportedTime > 0, "No outcome reported yet");
        require(!report.finalized, "Outcome already finalized");
        require(!report.disputed, "Already disputed");
        require(block.timestamp <= report.reportedTime + CHALLENGE_PERIOD, "Challenge period expired");

        usdcToken.safeTransferFrom(msg.sender, address(this), DISPUTE_BOND);

        report.disputed = true;
        report.challenger = msg.sender;
        report.disputeBond = DISPUTE_BOND;

        emit OutcomeChallenged(marketId, msg.sender, report.outcomeIndex, DISPUTE_BOND);
    }

    /**
     * @notice Resolve disputes (Meta-Arbitration called by protocol DAO owner).
     */
    function resolveDispute(uint256 marketId, uint256 finalOutcomeIndex, bool overturned) external onlyOwner nonReentrant {
        OutcomeReport storage report = reports[marketId];
        require(report.disputed, "Market is not in dispute");
        require(!report.finalized, "Outcome already finalized");

        report.finalized = true;
        report.outcomeIndex = finalOutcomeIndex;

        address reporter = report.reporter;
        address challenger = report.challenger;
        uint256 bond = report.disputeBond;
        report.disputeBond = 0;

        if (overturned) {
            // Challenger is correct. Slash reporter and reward challenger.
            if (customResolvers[marketId] == address(0)) {
                // If it was a validator, slash their validator stake
                uint256 slashAmount = validators[reporter].stakedAmount > MINIMUM_STAKE ? MINIMUM_STAKE : validators[reporter].stakedAmount;
                validators[reporter].stakedAmount -= slashAmount;
                validators[reporter].disputesLost++;
                if (validators[reporter].stakedAmount < MINIMUM_STAKE) {
                    validators[reporter].active = false;
                }
                // Send slashed tokens + original bond to challenger
                usdcToken.safeTransfer(challenger, bond + slashAmount);
            } else {
                // Self-Sovereign: Return dispute bond to challenger
                usdcToken.safeTransfer(challenger, bond);
            }
        } else {
            // Reporter is correct. Slash challenger bond and reward reporter.
            if (customResolvers[marketId] == address(0)) {
                validators[reporter].stakedAmount += bond; // Reward validator with challenger bond
            } else {
                usdcToken.safeTransfer(reporter, bond); // Reward EOA resolver
            }
            validators[reporter].marketsResolved++;
        }

        emit DisputeSettled(marketId, finalOutcomeIndex, overturned);
    }

    /**
     * @notice Auto-finalize reports if challenge window has passed without challenges.
     */
    function finalizeOutcome(uint256 marketId) external {
        OutcomeReport storage report = reports[marketId];
        require(report.reportedTime > 0, "No outcome reported yet");
        require(!report.finalized, "Outcome already finalized");
        require(!report.disputed, "Disputed: await DAO resolution");
        require(block.timestamp > report.reportedTime + CHALLENGE_PERIOD, "Challenge period active");

        report.finalized = true;
        if (customResolvers[marketId] == address(0)) {
            validators[report.reporter].marketsResolved++;
        }
    }

    /**
     * @notice Get outcome index reported by the registry (Interface implementation).
     */
    function getOutcome(uint256 marketId) external view override returns (bool ready, uint256 outcomeIndex) {
        OutcomeReport memory report = reports[marketId];
        if (report.finalized) {
            return (true, report.outcomeIndex);
        }
        return (false, 0);
    }
}
