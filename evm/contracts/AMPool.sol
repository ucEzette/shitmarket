// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ConditionalTokens.sol";

/**
 * @title AMPool
 * @notice Constant Product Market Maker (CPMM) for binary prediction market shares.
 * Users can swap USDC for YES/NO shares, or liquidate shares back to USDC.
 * Acts as the ERC-20 LP token for liquidity providers.
 * 
 * Fee Model:
 * - Total Swap Fee: 0.10% (10 bps)
 * - Liquidity Provider (LP) Share: 0.07% (7 bps) — claimable on-demand in USDC
 * - Platform Treasury Share: 0.03% (3 bps) — routed directly to protocol treasury
 */
contract AMPool is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    ConditionalTokens public immutable conditionalTokens;
    bytes32 public immutable conditionId;
    IERC20 public immutable usdcToken;
    address public immutable treasury;

    uint256 public constant TOTAL_FEE_BPS = 10; // 0.10% total swap fee
    uint256 public constant LP_FEE_BPS = 7;     // 0.07% to LPs
    uint256 public constant TREASURY_FEE_BPS = 3; // 0.03% to Platform Treasury
    uint256 public constant BPS_DIVISOR = 10000;
    uint256 private constant PRECISION = 1e18;

    // Reserves of YES (index 0) and NO (index 1) shares in the pool
    uint256[2] public reserves;

    // --- On-Chain Claimable Fee Accumulator (MasterChef / Staking model) ---
    uint256 public accFeePerShare; // Accumulated USDC fee per LP unit (scaled by 1e18)
    mapping(address => uint256) public feeDebt;
    mapping(address => uint256) public claimableFees;

    event LiquidityAdded(address indexed lp, uint256 usdcAmount, uint256 lpSharesMinted);
    event LiquidityRemoved(address indexed lp, uint256 lpSharesBurned, uint256 usdcReturned);
    event Swap(
        address indexed swapper,
        uint8 outcomeIndex, // 0 = YES, 1 = NO
        uint256 usdcSpent,
        uint256 sharesReceived,
        uint256 reserveYES,
        uint256 reserveNO,
        uint256 lpFee,
        uint256 treasuryFee
    );
    event FeesClaimed(address indexed lp, uint256 amount);

    constructor(
        address _conditionalTokens,
        bytes32 _conditionId,
        address _usdcToken,
        address _treasury
    ) ERC20("ShitMarket AMM LP Token", "SM-LP") {
        require(_conditionalTokens != address(0), "Invalid tokens contract");
        require(_usdcToken != address(0), "Invalid USDC");
        require(_treasury != address(0), "Invalid treasury");

        conditionalTokens = ConditionalTokens(_conditionalTokens);
        conditionId = _conditionId;
        usdcToken = IERC20(_usdcToken);
        treasury = _treasury;
    }

    /**
     * @notice Hook triggered by ERC-20 transfers, mints, and burns.
     * Updates fee accounting per address before balance changes.
     */
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0)) {
            _distributeFees(from);
        }
        if (to != address(0) && to != from) {
            _distributeFees(to);
        }

        super._update(from, to, value);

        if (from != address(0)) {
            feeDebt[from] = (balanceOf(from) * accFeePerShare) / PRECISION;
        }
        if (to != address(0)) {
            feeDebt[to] = (balanceOf(to) * accFeePerShare) / PRECISION;
        }
    }

    /**
     * @notice Internal fee snapshot calculation for an account.
     */
    function _distributeFees(address account) internal {
        uint256 balance = balanceOf(account);
        if (balance > 0) {
            uint256 accumulated = (balance * accFeePerShare) / PRECISION;
            if (accumulated > feeDebt[account]) {
                claimableFees[account] += (accumulated - feeDebt[account]);
            }
        }
    }

    /**
     * @notice View pending claimable USDC fees for a liquidity provider.
     */
    function getClaimableFees(address lp) public view returns (uint256) {
        uint256 pending = claimableFees[lp];
        uint256 balance = balanceOf(lp);
        if (balance > 0) {
            uint256 accumulated = (balance * accFeePerShare) / PRECISION;
            if (accumulated > feeDebt[lp]) {
                pending += (accumulated - feeDebt[lp]);
            }
        }
        return pending;
    }

    /**
     * @notice Claim accrued USDC swap fees directly without removing liquidity.
     */
    function claimFees() external nonReentrant returns (uint256) {
        _distributeFees(msg.sender);
        feeDebt[msg.sender] = (balanceOf(msg.sender) * accFeePerShare) / PRECISION;

        uint256 amount = claimableFees[msg.sender];
        require(amount > 0, "No fees to claim");

        claimableFees[msg.sender] = 0;
        usdcToken.safeTransfer(msg.sender, amount);

        emit FeesClaimed(msg.sender, amount);
        return amount;
    }

    /**
     * @notice Helper to get token IDs from ConditionalTokens contract
     */
    function getTokenId(uint256 outcomeIndex) public view returns (uint256) {
        return conditionalTokens.getTokenId(conditionId, outcomeIndex);
    }

    /**
     * @notice Add liquidity to the pool.
     * User provides USDC. The pool splits USDC into YES and NO shares,
     * adding them to reserves in proportion to the existing ratio.
     */
    function addLiquidity(uint256 usdcAmount) external nonReentrant returns (uint256) {
        require(usdcAmount > 0, "USDC amount must be positive");

        uint256 lpMintAmount;
        uint256 totalLp = totalSupply();

        if (totalLp == 0) {
            // First liquidity provision: split USDC and add equally
            usdcToken.safeTransferFrom(msg.sender, address(this), usdcAmount);
            
            // Approve and split USDC into YES and NO
            usdcToken.forceApprove(address(conditionalTokens), usdcAmount);
            conditionalTokens.splitPosition(conditionId, usdcAmount);

            reserves[0] = usdcAmount;
            reserves[1] = usdcAmount;
            lpMintAmount = usdcAmount;
        } else {
            // Subsequential LP: maintain the exact ratio of YES vs NO
            uint256 shareAmount0 = (usdcAmount * reserves[0]) / (reserves[0] + reserves[1]);
            uint256 shareAmount1 = usdcAmount - shareAmount0;

            usdcToken.safeTransferFrom(msg.sender, address(this), usdcAmount);
            usdcToken.forceApprove(address(conditionalTokens), usdcAmount);
            conditionalTokens.splitPosition(conditionId, usdcAmount);

            reserves[0] += shareAmount0;
            reserves[1] += shareAmount1;
            lpMintAmount = (usdcAmount * totalLp) / (reserves[0] + reserves[1]);
        }

        _mint(msg.sender, lpMintAmount);

        emit LiquidityAdded(msg.sender, usdcAmount, lpMintAmount);
        return lpMintAmount;
    }

    /**
     * @notice Remove liquidity and withdraw underlying assets back to USDC.
     */
    function removeLiquidity(uint256 lpAmount) external nonReentrant returns (uint256) {
        require(lpAmount > 0, "LP amount must be positive");
        uint256 totalLp = totalSupply();
        require(totalLp >= lpAmount, "Insufficient LP balance");

        // Calculate proportion of reserves to return
        uint256 returnAmount0 = (reserves[0] * lpAmount) / totalLp;
        uint256 returnAmount1 = (reserves[1] * lpAmount) / totalLp;

        reserves[0] -= returnAmount0;
        reserves[1] -= returnAmount1;

        _burn(msg.sender, lpAmount);

        // Merge YES and NO shares back into USDC
        uint256 mergeAmount = returnAmount0 < returnAmount1 ? returnAmount0 : returnAmount1;
        
        // Transfer raw outcome tokens for any surplus if ratios were skewed
        if (returnAmount0 > mergeAmount) {
            uint256 surplus0 = returnAmount0 - mergeAmount;
            IERC1155(address(conditionalTokens)).safeTransferFrom(
                address(this),
                msg.sender,
                getTokenId(0),
                surplus0,
                ""
            );
        }
        if (returnAmount1 > mergeAmount) {
            uint256 surplus1 = returnAmount1 - mergeAmount;
            IERC1155(address(conditionalTokens)).safeTransferFrom(
                address(this),
                msg.sender,
                getTokenId(1),
                surplus1,
                ""
            );
        }

        // Merge equal portions back to USDC
        if (mergeAmount > 0) {
            conditionalTokens.mergePositions(conditionId, mergeAmount);
            usdcToken.safeTransfer(msg.sender, mergeAmount);
        }

        emit LiquidityRemoved(msg.sender, lpAmount, mergeAmount);
        return mergeAmount;
    }

    /**
     * @notice Swap USDC to acquire YES (0) or NO (1) outcome shares.
     * 0.10% total fee: 0.07% to LPs (claimable), 0.03% to treasury.
     */
    function buyShares(uint8 outcomeIndex, uint256 usdcSpent) external nonReentrant returns (uint256) {
        require(outcomeIndex == 0 || outcomeIndex == 1, "Invalid outcome index");
        require(usdcSpent > 0, "Spent amount must be positive");

        uint8 oppositeIndex = outcomeIndex == 0 ? 1 : 0;
        uint256 rTarget = reserves[outcomeIndex];
        uint256 rOpposite = reserves[oppositeIndex];

        // Deduct 0.10% total fee (0.07% LP + 0.03% Treasury)
        uint256 totalFee = (usdcSpent * TOTAL_FEE_BPS) / BPS_DIVISOR;
        uint256 treasuryFee = (usdcSpent * TREASURY_FEE_BPS) / BPS_DIVISOR;
        uint256 lpFee = totalFee - treasuryFee;
        uint256 netUsdc = usdcSpent - totalFee;

        // CPMM Math: (R_target - dy) * (R_opposite + netUsdc) = k
        uint256 k = rTarget * rOpposite;
        uint256 newOppositeReserve = rOpposite + netUsdc;
        uint256 newTargetReserve = k / newOppositeReserve;
        uint256 sharesReceived = rTarget - newTargetReserve;

        require(sharesReceived > 0, "Slippage too high: zero shares output");

        // Transfer full USDC from user and split netUsdc into position tokens
        usdcToken.safeTransferFrom(msg.sender, address(this), usdcSpent);
        usdcToken.forceApprove(address(conditionalTokens), netUsdc);
        conditionalTokens.splitPosition(conditionId, netUsdc);

        // Route treasury fee
        if (treasuryFee > 0) {
            usdcToken.safeTransfer(treasury, treasuryFee);
        }

        // Accrue LP fee
        uint256 currentSupply = totalSupply();
        if (lpFee > 0 && currentSupply > 0) {
            accFeePerShare += (lpFee * PRECISION) / currentSupply;
        }

        // Update reserves
        reserves[outcomeIndex] = newTargetReserve;
        reserves[oppositeIndex] = newOppositeReserve;

        // Transfer output shares to swapper
        IERC1155(address(conditionalTokens)).safeTransferFrom(
            address(this),
            msg.sender,
            getTokenId(outcomeIndex),
            sharesReceived,
            ""
        );

        emit Swap(msg.sender, outcomeIndex, usdcSpent, sharesReceived, reserves[0], reserves[1], lpFee, treasuryFee);
        return sharesReceived;
    }

    /**
     * @notice Swap/Liquidate YES (0) or NO (1) shares back to USDC.
     * 0.10% total fee: 0.07% to LPs (claimable), 0.03% to treasury.
     */
    function sellShares(uint8 outcomeIndex, uint256 sharesSold) external nonReentrant returns (uint256) {
        require(outcomeIndex == 0 || outcomeIndex == 1, "Invalid outcome index");
        require(sharesSold > 0, "Shares amount must be positive");

        uint8 oppositeIndex = outcomeIndex == 0 ? 1 : 0;
        uint256 rTarget = reserves[outcomeIndex];
        uint256 rOpposite = reserves[oppositeIndex];

        // Receive shares from user
        IERC1155(address(conditionalTokens)).safeTransferFrom(
            msg.sender,
            address(this),
            getTokenId(outcomeIndex),
            sharesSold,
            ""
        );

        // CPMM Math for selling:
        uint256 k = rTarget * rOpposite;
        uint256 newTargetReserve = rTarget + sharesSold;
        uint256 newOppositeReserve = k / newTargetReserve;
        uint256 rawPayout = rOpposite - newOppositeReserve;

        // Deduct 0.10% total fee (0.07% LP + 0.03% Treasury)
        uint256 totalFee = (rawPayout * TOTAL_FEE_BPS) / BPS_DIVISOR;
        uint256 treasuryFee = (rawPayout * TREASURY_FEE_BPS) / BPS_DIVISOR;
        uint256 lpFee = totalFee - treasuryFee;
        uint256 netPayout = rawPayout - totalFee;

        require(netPayout > 0, "Payout too small");

        // Merge matching YES/NO to retrieve rawPayout USDC
        conditionalTokens.mergePositions(conditionId, rawPayout);

        // Send net payout to seller
        usdcToken.safeTransfer(msg.sender, netPayout);

        // Route treasury fee
        if (treasuryFee > 0) {
            usdcToken.safeTransfer(treasury, treasuryFee);
        }

        // Accrue LP fee
        uint256 currentSupply = totalSupply();
        if (lpFee > 0 && currentSupply > 0) {
            accFeePerShare += (lpFee * PRECISION) / currentSupply;
        }

        // Update reserves
        reserves[outcomeIndex] = newTargetReserve;
        reserves[oppositeIndex] = newOppositeReserve;

        emit Swap(msg.sender, oppositeIndex, netPayout, sharesSold, reserves[0], reserves[1], lpFee, treasuryFee);
        return netPayout;
    }

    // Required override for ERC1155 holder interface compatibility
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
