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
 * @notice Constant Product Market Maker (CPMM) for multi-outcome prediction market shares.
 * Users can swap USDC for outcome shares, or liquidate shares back to USDC.
 * Acts as the ERC-20 LP token for liquidity providers.
 * 
 * Fee Model:
 * - Total Swap Fee: 0.10% (10 bps)
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

    // Reserves of outcome shares in the pool
    uint256[] public reserves;
    uint256 public immutable outcomeCount;

    // --- On-Chain Claimable Fee Accumulator (MasterChef / Staking model) ---
    uint256 public accFeePerShare; // Accumulated USDC fee per LP unit (scaled by 1e18)
    mapping(address => uint256) public feeDebt;
    mapping(address => uint256) public claimableFees;

    event LiquidityAdded(address indexed lp, uint256 usdcAmount, uint256 lpSharesMinted);
    event LiquidityRemoved(address indexed lp, uint256 lpSharesBurned, uint256 usdcReturned);
    event Swap(
        address indexed swapper,
        uint8 outcomeIndex,
        uint256 usdcSpent,
        uint256 sharesReceived,
        uint256[] reserves,
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

        uint256 count = conditionalTokens.outcomeCounts(_conditionId);
        require(count >= 2, "Outcome count must be at least 2");
        outcomeCount = count;
        for (uint256 i = 0; i < count; i++) {
            reserves.push(0);
        }
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
     */
    function addLiquidity(uint256 usdcAmount) external nonReentrant returns (uint256) {
        require(usdcAmount > 0, "USDC amount must be positive");

        uint256 lpMintAmount;
        uint256 totalLp = totalSupply();

        if (totalLp == 0) {
            usdcToken.safeTransferFrom(msg.sender, address(this), usdcAmount);
            usdcToken.forceApprove(address(conditionalTokens), usdcAmount);
            conditionalTokens.splitPosition(conditionId, usdcAmount);

            for (uint256 i = 0; i < outcomeCount; i++) {
                reserves[i] = usdcAmount;
            }
            lpMintAmount = usdcAmount;
        } else {
            usdcToken.safeTransferFrom(msg.sender, address(this), usdcAmount);
            usdcToken.forceApprove(address(conditionalTokens), usdcAmount);
            conditionalTokens.splitPosition(conditionId, usdcAmount);

            uint256 sumReserves = 0;
            for (uint256 i = 0; i < outcomeCount; i++) {
                sumReserves += reserves[i];
            }

            for (uint256 i = 0; i < outcomeCount; i++) {
                uint256 shareAmount = (usdcAmount * reserves[i]) / sumReserves;
                reserves[i] += shareAmount;
            }
            lpMintAmount = (usdcAmount * totalLp) / sumReserves;
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

        uint256 sumReserves = 0;
        for (uint256 i = 0; i < outcomeCount; i++) {
            sumReserves += reserves[i];
        }

        uint256[] memory returnAmounts = new uint256[](outcomeCount);
        uint256 minReturn = type(uint256).max;
        for (uint256 i = 0; i < outcomeCount; i++) {
            returnAmounts[i] = (reserves[i] * lpAmount) / totalLp;
            reserves[i] -= returnAmounts[i];
            if (returnAmounts[i] < minReturn) {
                minReturn = returnAmounts[i];
            }
        }

        _burn(msg.sender, lpAmount);

        for (uint256 i = 0; i < outcomeCount; i++) {
            uint256 surplus = returnAmounts[i] - minReturn;
            if (surplus > 0) {
                IERC1155(address(conditionalTokens)).safeTransferFrom(
                    address(this),
                    msg.sender,
                    getTokenId(i),
                    surplus,
                    ""
                );
            }
        }

        if (minReturn > 0) {
            conditionalTokens.mergePositions(conditionId, minReturn);
            usdcToken.safeTransfer(msg.sender, minReturn);
        }

        emit LiquidityRemoved(msg.sender, lpAmount, minReturn);
        return minReturn;
    }

    /**
     * @notice Swap USDC to acquire outcome shares.
     */
    function buyShares(uint8 outcomeIndex, uint256 usdcSpent) external nonReentrant returns (uint256) {
        require(outcomeIndex < outcomeCount, "Invalid outcome index");
        require(usdcSpent > 0, "Spent amount must be positive");

        uint256 totalFee = (usdcSpent * TOTAL_FEE_BPS) / BPS_DIVISOR;
        uint256 treasuryFee = (usdcSpent * TREASURY_FEE_BPS) / BPS_DIVISOR;
        uint256 lpFee = totalFee - treasuryFee;
        uint256 netUsdc = usdcSpent - totalFee;

        uint256 targetReserve = reserves[outcomeIndex];
        
        uint256 prodBefore = 1;
        uint256 prodAfter = 1;
        for (uint256 j = 0; j < outcomeCount; j++) {
            if (j != outcomeIndex) {
                prodBefore *= reserves[j];
                prodAfter *= (reserves[j] + netUsdc);
            }
        }

        uint256 newTargetReserve = (targetReserve * prodBefore) / prodAfter;
        uint256 sharesReceived = targetReserve + netUsdc - newTargetReserve;

        require(sharesReceived > 0, "Slippage too high: zero shares output");

        usdcToken.safeTransferFrom(msg.sender, address(this), usdcSpent);
        usdcToken.forceApprove(address(conditionalTokens), netUsdc);
        conditionalTokens.splitPosition(conditionId, netUsdc);

        if (treasuryFee > 0) {
            usdcToken.safeTransfer(treasury, treasuryFee);
        }

        uint256 currentSupply = totalSupply();
        if (lpFee > 0 && currentSupply > 0) {
            accFeePerShare += (lpFee * PRECISION) / currentSupply;
        }

        reserves[outcomeIndex] = newTargetReserve;
        for (uint256 j = 0; j < outcomeCount; j++) {
            if (j != outcomeIndex) {
                reserves[j] += netUsdc;
            }
        }

        IERC1155(address(conditionalTokens)).safeTransferFrom(
            address(this),
            msg.sender,
            getTokenId(outcomeIndex),
            sharesReceived,
            ""
        );

        emit Swap(msg.sender, outcomeIndex, usdcSpent, sharesReceived, reserves, lpFee, treasuryFee);
        return sharesReceived;
    }

    /**
     * @notice Swap/Liquidate outcome shares back to USDC.
     */
    function sellShares(uint8 outcomeIndex, uint256 sharesSold) external nonReentrant returns (uint256) {
        require(outcomeIndex < outcomeCount, "Invalid outcome index");
        require(sharesSold > 0, "Shares amount must be positive");

        IERC1155(address(conditionalTokens)).safeTransferFrom(
            msg.sender,
            address(this),
            getTokenId(outcomeIndex),
            sharesSold,
            ""
        );

        uint256 targetReserve = reserves[outcomeIndex];
        uint256 newTargetReserve = targetReserve + sharesSold;
        
        uint256 m = outcomeCount - 1;
        uint256 rawPayout = type(uint256).max;
        for (uint256 j = 0; j < outcomeCount; j++) {
            if (j != outcomeIndex) {
                uint256 payout_j = (reserves[j] * sharesSold) / (newTargetReserve * m);
                if (payout_j < rawPayout) {
                    rawPayout = payout_j;
                }
            }
        }

        uint256 totalFee = (rawPayout * TOTAL_FEE_BPS) / BPS_DIVISOR;
        uint256 treasuryFee = (rawPayout * TREASURY_FEE_BPS) / BPS_DIVISOR;
        uint256 lpFee = totalFee - treasuryFee;
        uint256 netPayout = rawPayout - totalFee;

        require(netPayout > 0, "Payout too small");

        conditionalTokens.mergePositions(conditionId, rawPayout);
        usdcToken.safeTransfer(msg.sender, netPayout);

        if (treasuryFee > 0) {
            usdcToken.safeTransfer(treasury, treasuryFee);
        }

        uint256 currentSupply = totalSupply();
        if (lpFee > 0 && currentSupply > 0) {
            accFeePerShare += (lpFee * PRECISION) / currentSupply;
        }

        reserves[outcomeIndex] = newTargetReserve;
        for (uint256 j = 0; j < outcomeCount; j++) {
            if (j != outcomeIndex) {
                reserves[j] -= rawPayout;
            }
        }

        emit Swap(msg.sender, outcomeIndex, netPayout, sharesSold, reserves, lpFee, treasuryFee);
        return netPayout;
    }

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
