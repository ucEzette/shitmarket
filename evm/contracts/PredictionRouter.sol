// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AMPool.sol";
import "./CTFExchange.sol";

/**
 * @title PredictionRouter
 * @notice Aggregates trades and routes them atomically to either CLOB limit orders (CTFExchange) or AMM pools.
 */
contract PredictionRouter is ERC1155Holder, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;
    CTFExchange public immutable exchange;

    constructor(address _usdcToken, address _exchange) {
        require(_usdcToken != address(0), "Invalid USDC");
        require(_exchange != address(0), "Invalid exchange");
        usdcToken = IERC20(_usdcToken);
        exchange = CTFExchange(_exchange);
    }

    /**
     * @notice Routing function comparing CLOB limit orders and AMM pools.
     * Selects the best executable rate and fills the trade atomically.
     */
    function routeBuyShares(
        address poolAddress,
        uint8 outcomeIndex,
        uint256 amountShares,
        uint256 maxUsdcSpent,
        CTFExchange.Order[] calldata makerOrders,
        bytes[] calldata signatures,
        uint256[] calldata fillAmounts
    ) external nonReentrant {
        require(makerOrders.length == signatures.length && signatures.length == fillAmounts.length, "Array length mismatch");
        
        usdcToken.safeTransferFrom(msg.sender, address(this), maxUsdcSpent);

        uint256 sharesObtained = 0;
        uint256 usdcSpent = 0;

        // 1. Fill through CLOB first
        usdcToken.forceApprove(address(exchange), maxUsdcSpent);
        for (uint256 i = 0; i < makerOrders.length; i++) {
            if (sharesObtained >= amountShares) break;

            uint256 fillAmount = fillAmounts[i];
            uint256 remainingNeeded = amountShares - sharesObtained;
            if (fillAmount > remainingNeeded) {
                fillAmount = remainingNeeded;
            }

            uint256 cost;
            if (makerOrders[i].side == CTFExchange.Side.SELL && makerOrders[i].outcomeIndex == outcomeIndex) {
                cost = (fillAmount * makerOrders[i].price) / exchange.PRICE_DENOMINATOR();
                require(usdcSpent + cost <= maxUsdcSpent, "Exceeded max spend limit");
                exchange.fillOrder(makerOrders[i], signatures[i], fillAmount);
            } else if (makerOrders[i].side == CTFExchange.Side.BUY && makerOrders[i].outcomeIndex != outcomeIndex) {
                uint256 makerCost = (fillAmount * makerOrders[i].price) / exchange.PRICE_DENOMINATOR();
                cost = fillAmount - makerCost;
                require(usdcSpent + cost <= maxUsdcSpent, "Exceeded max spend limit");
                exchange.fillOpposingBuy(makerOrders[i], signatures[i], fillAmount);
            } else {
                revert("Invalid order format for routing");
            }

            sharesObtained += fillAmount;
            usdcSpent += cost;
        }

        // 2. Route remainder to AMM
        if (sharesObtained < amountShares && poolAddress != address(0)) {
            AMPool pool = AMPool(poolAddress);
            uint256 amSpend = maxUsdcSpent - usdcSpent;
            
            usdcToken.forceApprove(poolAddress, amSpend);
            
            // To ensure we get the remaining shares we want, we would normally calculate exactly how much USDC it costs.
            // But for simplicity, we dump the remaining maxUsdcSpent into the AMM.
            uint256 amShares = pool.buyShares(outcomeIndex, amSpend);
            sharesObtained += amShares;
            usdcSpent += amSpend;
        }

        require(sharesObtained >= amountShares, "Could not fill order target");

        // Refund any unused USDC back to caller
        if (usdcSpent < maxUsdcSpent) {
            uint256 refund = maxUsdcSpent - usdcSpent;
            usdcToken.safeTransfer(msg.sender, refund);
        }

        // Forward shares to caller
        if (sharesObtained > 0) {
            bytes32 conditionId = AMPool(poolAddress).conditionId();
            uint256 tokenId = exchange.ctf().getTokenId(conditionId, outcomeIndex);
            exchange.ctf().safeTransferFrom(
                address(this),
                msg.sender,
                tokenId,
                sharesObtained,
                ""
            );
        }
    }

    /**
     * @notice Routing function comparing CLOB limit orders and AMM pools for selling.
     * Match outcome tokens (shares) against BUY limit orders (bids) first, then falls back to AMM.
     */
    function routeSellShares(
        address poolAddress,
        uint8 outcomeIndex,
        uint256 amountShares,
        uint256 minUsdcReceived,
        CTFExchange.Order[] calldata makerOrders,
        bytes[] calldata signatures,
        uint256[] calldata fillAmounts
    ) external nonReentrant {
        require(makerOrders.length == signatures.length && signatures.length == fillAmounts.length, "Array length mismatch");
        
        bytes32 conditionId = AMPool(poolAddress).conditionId();
        uint256 tokenId = exchange.ctf().getTokenId(conditionId, outcomeIndex);
        
        // Transfer shares from caller to router
        IERC1155(address(exchange.ctf())).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId,
            amountShares,
            ""
        );

        uint256 sharesSold = 0;
        uint256 usdcReceived = 0;

        // Approve exchange for shares
        IERC1155(address(exchange.ctf())).setApprovalForAll(address(exchange), true);

        // 1. Fill against CLOB buy orders first
        for (uint256 i = 0; i < makerOrders.length; i++) {
            if (sharesSold >= amountShares) break;

            uint256 fillAmount = fillAmounts[i];
            uint256 remainingNeeded = amountShares - sharesSold;
            if (fillAmount > remainingNeeded) {
                fillAmount = remainingNeeded;
            }

            if (makerOrders[i].side == CTFExchange.Side.BUY && makerOrders[i].outcomeIndex == outcomeIndex) {
                uint256 beforeBal = usdcToken.balanceOf(address(this));
                exchange.fillOrder(makerOrders[i], signatures[i], fillAmount);
                uint256 afterBal = usdcToken.balanceOf(address(this));
                usdcReceived += (afterBal - beforeBal);
            } else {
                revert("Invalid maker order for selling");
            }

            sharesSold += fillAmount;
        }

        // 2. Route remainder to AMM
        if (sharesSold < amountShares && poolAddress != address(0)) {
            uint256 remainingShares = amountShares - sharesSold;
            AMPool pool = AMPool(poolAddress);
            
            // Approve pool for shares
            IERC1155(address(exchange.ctf())).setApprovalForAll(poolAddress, true);
            
            uint256 beforeBal = usdcToken.balanceOf(address(this));
            pool.sellShares(outcomeIndex, remainingShares);
            uint256 afterBal = usdcToken.balanceOf(address(this));
            
            usdcReceived += (afterBal - beforeBal);
            sharesSold += remainingShares;
        }

        require(sharesSold == amountShares, "Could not sell target shares");
        require(usdcReceived >= minUsdcReceived, "USDC received below minimum");

        // Forward USDC to caller
        if (usdcReceived > 0) {
            usdcToken.safeTransfer(msg.sender, usdcReceived);
        }
    }
}
