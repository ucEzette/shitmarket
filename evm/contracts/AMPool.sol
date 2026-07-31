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
 */
contract AMPool is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    ConditionalTokens public immutable conditionalTokens;
    bytes32 public immutable conditionId;
    IERC20 public immutable usdcToken;

    uint256 public constant FEE_BPS = 30; // 0.3% swap fee
    uint256 public constant BPS_DIVISOR = 10000;

    // Reserves of YES (index 0) and NO (index 1) shares in the pool
    uint256[2] public reserves;

    event LiquidityAdded(address indexed lp, uint256 usdcAmount, uint256 lpSharesMinted);
    event LiquidityRemoved(address indexed lp, uint256 lpSharesBurned, uint256 usdcReturned);
    event Swap(
        address indexed swapper,
        uint8 outcomeIndex, // 0 = YES, 1 = NO
        uint256 usdcSpent,
        uint256 sharesReceived,
        uint256 reserveYES,
        uint256 reserveNO
    );

    constructor(
        address _conditionalTokens,
        bytes32 _conditionId,
        address _usdcToken
    ) ERC20("ShitMarket AMM LP Token", "SM-LP") {
        require(_conditionalTokens != address(0), "Invalid tokens contract");
        require(_usdcToken != address(0), "Invalid USDC");

        conditionalTokens = ConditionalTokens(_conditionalTokens);
        conditionId = _conditionId;
        usdcToken = IERC20(_usdcToken);
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
            // LP provides USDC. We transfer and split it, adding to reserves.
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
     * Direct instant swap execution.
     */
    function buyShares(uint8 outcomeIndex, uint256 usdcSpent) external nonReentrant returns (uint256) {
        require(outcomeIndex == 0 || outcomeIndex == 1, "Invalid outcome index");
        require(usdcSpent > 0, "Spent amount must be positive");

        uint8 oppositeIndex = outcomeIndex == 0 ? 1 : 0;
        uint256 rTarget = reserves[outcomeIndex];
        uint256 rOpposite = reserves[oppositeIndex];

        // Deduct 0.3% fee
        uint256 fee = (usdcSpent * FEE_BPS) / BPS_DIVISOR;
        uint256 netUsdc = usdcSpent - fee;

        // CPMM Math: (R_target - dy) * (R_opposite + netUsdc) = k
        uint256 k = rTarget * rOpposite;
        uint256 newOppositeReserve = rOpposite + netUsdc;
        uint256 newTargetReserve = k / newOppositeReserve;
        uint256 sharesReceived = rTarget - newTargetReserve;

        require(sharesReceived > 0, "Slippage too high: zero shares output");

        // Transfer USDC from user and split it
        usdcToken.safeTransferFrom(msg.sender, address(this), usdcSpent);
        usdcToken.forceApprove(address(conditionalTokens), usdcSpent);
        conditionalTokens.splitPosition(conditionId, usdcSpent);

        // Update reserves
        reserves[outcomeIndex] = newTargetReserve + fee; // Add fee to reserve
        reserves[oppositeIndex] = newOppositeReserve;

        // Transfer output shares to swapper
        IERC1155(address(conditionalTokens)).safeTransferFrom(
            address(this),
            msg.sender,
            getTokenId(outcomeIndex),
            sharesReceived,
            ""
        );

        emit Swap(msg.sender, outcomeIndex, usdcSpent, sharesReceived, reserves[0], reserves[1]);
        return sharesReceived;
    }

    /**
     * @notice Swap/Liquidate YES (0) or NO (1) shares back to USDC.
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
        // We add sharesSold to rTarget. The pool product is maintained.
        // USDC output (payout) is determined by how much opposite token we release.
        uint256 k = rTarget * rOpposite;
        uint256 newTargetReserve = rTarget + sharesSold;
        uint256 newOppositeReserve = k / newTargetReserve;
        uint256 rawPayout = rOpposite - newOppositeReserve;

        // Deduct 0.3% fee from payout
        uint256 fee = (rawPayout * FEE_BPS) / BPS_DIVISOR;
        uint256 netPayout = rawPayout - fee;

        require(netPayout > 0, "Payout too small");

        // Update reserves
        reserves[outcomeIndex] = newTargetReserve;
        reserves[oppositeIndex] = newOppositeReserve + fee;

        // Merge matching YES/NO to retrieve USDC
        conditionalTokens.mergePositions(conditionId, netPayout);
        usdcToken.safeTransfer(msg.sender, netPayout);

        emit Swap(msg.sender, oppositeIndex, netPayout, sharesSold, reserves[0], reserves[1]);
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
