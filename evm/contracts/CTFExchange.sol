// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ConditionalTokens.sol";

contract CTFExchange is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    ConditionalTokens public immutable ctf;
    uint256 public constant PRICE_DENOMINATOR = 1000000; // 1 USDC = 1,000,000 micro-USDC (6 decimals)

    bytes32 constant ORDER_TYPEHASH = keccak256(
        "Order(address maker,bytes32 conditionId,uint8 outcomeIndex,uint256 price,uint256 amount,uint8 side,uint256 nonce,uint256 expiration)"
    );

    // maker => nonce => filledAmount
    mapping(address => mapping(uint256 => uint256)) public filledAmount;
    mapping(address => mapping(uint256 => bool)) public isCancelled;

    enum Side { BUY, SELL }

    struct Order {
        address maker;
        bytes32 conditionId;
        uint8 outcomeIndex; // 0 for YES, 1 for NO
        uint256 price; // e.g. 600000 for 0.6 USDC
        uint256 amount; // Number of shares
        Side side;
        uint256 nonce;
        uint256 expiration;
    }

    event OrderFilled(
        bytes32 indexed orderHash,
        address indexed maker,
        address indexed taker,
        uint256 fillAmount,
        uint256 price
    );
    event OrderCancelled(address indexed maker, uint256 nonce);

    constructor(address _usdc, address _ctf) EIP712("CTFExchange", "1") {
        usdc = IERC20(_usdc);
        ctf = ConditionalTokens(_ctf);
    }

    function hashOrder(Order memory order) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    ORDER_TYPEHASH,
                    order.maker,
                    order.conditionId,
                    order.outcomeIndex,
                    order.price,
                    order.amount,
                    order.side,
                    order.nonce,
                    order.expiration
                )
            )
        );
    }

    function cancelOrder(uint256 nonce) external {
        isCancelled[msg.sender][nonce] = true;
        emit OrderCancelled(msg.sender, nonce);
    }

    function verifySignature(Order memory order, bytes memory signature) public view returns (bool) {
        bytes32 digest = hashOrder(order);
        address signer = ECDSA.recover(digest, signature);
        return signer == order.maker;
    }

    /**
     * @notice Taker fills a Maker's order directly.
     * If Maker is BUY, Taker provides shares and receives USDC.
     * If Maker is SELL, Taker provides USDC and receives shares.
     */
    function fillOrder(
        Order calldata order,
        bytes calldata signature,
        uint256 fillAmount
    ) external nonReentrant {
        require(block.timestamp <= order.expiration, "Order expired");
        require(!isCancelled[order.maker][order.nonce], "Order cancelled");
        require(verifySignature(order, signature), "Invalid signature");

        uint256 remaining = order.amount - filledAmount[order.maker][order.nonce];
        require(fillAmount > 0 && fillAmount <= remaining, "Invalid fill amount");

        filledAmount[order.maker][order.nonce] += fillAmount;

        uint256 tokenId = ctf.getTokenId(order.conditionId, order.outcomeIndex);
        uint256 usdcValue = (fillAmount * order.price) / PRICE_DENOMINATOR;

        if (order.side == Side.BUY) {
            // Maker buys shares, Taker sells shares
            // Take USDC from Maker, send to Taker
            usdc.safeTransferFrom(order.maker, msg.sender, usdcValue);
            // Take shares from Taker, send to Maker
            ctf.safeTransferFrom(msg.sender, order.maker, tokenId, fillAmount, "");
        } else {
            // Maker sells shares, Taker buys shares
            // Take USDC from Taker, send to Maker
            usdc.safeTransferFrom(msg.sender, order.maker, usdcValue);
            // Take shares from Maker, send to Taker
            ctf.safeTransferFrom(order.maker, msg.sender, tokenId, fillAmount, "");
        }

        emit OrderFilled(hashOrder(order), order.maker, msg.sender, fillAmount, order.price);
    }

    /**
     * @notice Match a YES Buy Order with a NO Buy Order to mint new shares.
     * Total prices must sum to exactly 1 USDC (1,000,000).
     */
    function matchOrders(
        Order calldata makerOrder,
        bytes calldata makerSignature,
        Order calldata takerOrder,
        bytes calldata takerSignature,
        uint256 fillAmount
    ) external nonReentrant {
        require(block.timestamp <= makerOrder.expiration && block.timestamp <= takerOrder.expiration, "Order expired");
        require(!isCancelled[makerOrder.maker][makerOrder.nonce] && !isCancelled[takerOrder.maker][takerOrder.nonce], "Order cancelled");
        require(makerOrder.conditionId == takerOrder.conditionId, "Condition mismatch");
        require(makerOrder.side == Side.BUY && takerOrder.side == Side.BUY, "Must be buy orders");
        require(makerOrder.outcomeIndex != takerOrder.outcomeIndex, "Must be opposing outcomes");
        require(makerOrder.price + takerOrder.price >= PRICE_DENOMINATOR, "Price mismatch");
        
        require(verifySignature(makerOrder, makerSignature), "Invalid maker sig");
        
        // If taker is not the one sending the tx, we need their signature too
        if (msg.sender != takerOrder.maker) {
            require(verifySignature(takerOrder, takerSignature), "Invalid taker sig");
        }

        uint256 makerRemaining = makerOrder.amount - filledAmount[makerOrder.maker][makerOrder.nonce];
        uint256 takerRemaining = takerOrder.amount - filledAmount[takerOrder.maker][takerOrder.nonce];
        require(fillAmount > 0 && fillAmount <= makerRemaining && fillAmount <= takerRemaining, "Invalid fill amount");

        filledAmount[makerOrder.maker][makerOrder.nonce] += fillAmount;
        filledAmount[takerOrder.maker][takerOrder.nonce] += fillAmount;

        uint256 makerCost = (fillAmount * makerOrder.price) / PRICE_DENOMINATOR;
        uint256 takerCost = fillAmount - makerCost; // Give any slippage discount to taker for simplicity, or strict math

        usdc.safeTransferFrom(makerOrder.maker, address(this), makerCost);
        usdc.safeTransferFrom(takerOrder.maker, address(this), takerCost);

        usdc.forceApprove(address(ctf), fillAmount);
        ctf.splitPosition(makerOrder.conditionId, fillAmount);

        uint256 makerTokenId = ctf.getTokenId(makerOrder.conditionId, makerOrder.outcomeIndex);
        uint256 takerTokenId = ctf.getTokenId(takerOrder.conditionId, takerOrder.outcomeIndex);

        ctf.safeTransferFrom(address(this), makerOrder.maker, makerTokenId, fillAmount, "");
        ctf.safeTransferFrom(address(this), takerOrder.maker, takerTokenId, fillAmount, "");

        emit OrderFilled(hashOrder(makerOrder), makerOrder.maker, address(this), fillAmount, makerOrder.price);
        emit OrderFilled(hashOrder(takerOrder), takerOrder.maker, address(this), fillAmount, takerOrder.price);
    }

    /**
     * @notice Taker (msg.sender) provides USDC to match against a Maker's BUY order for the opposing outcome.
     * The contract merges the USDC, splits into conditional tokens, sends Maker their outcome, and Taker the opposing outcome.
     */
    function fillOpposingBuy(
        Order calldata makerOrder,
        bytes calldata signature,
        uint256 fillAmount
    ) external nonReentrant {
        require(block.timestamp <= makerOrder.expiration, "Order expired");
        require(!isCancelled[makerOrder.maker][makerOrder.nonce], "Order cancelled");
        require(makerOrder.side == Side.BUY, "Maker must be BUY");
        require(verifySignature(makerOrder, signature), "Invalid signature");

        uint256 remaining = makerOrder.amount - filledAmount[makerOrder.maker][makerOrder.nonce];
        require(fillAmount > 0 && fillAmount <= remaining, "Invalid fill amount");

        filledAmount[makerOrder.maker][makerOrder.nonce] += fillAmount;

        uint256 makerCost = (fillAmount * makerOrder.price) / PRICE_DENOMINATOR;
        uint256 takerCost = fillAmount - makerCost;

        usdc.safeTransferFrom(makerOrder.maker, address(this), makerCost);
        usdc.safeTransferFrom(msg.sender, address(this), takerCost);

        usdc.forceApprove(address(ctf), fillAmount);
        ctf.splitPosition(makerOrder.conditionId, fillAmount);

        uint256 makerTokenId = ctf.getTokenId(makerOrder.conditionId, makerOrder.outcomeIndex);
        uint8 takerOutcomeIndex = makerOrder.outcomeIndex == 0 ? 1 : 0;
        uint256 takerTokenId = ctf.getTokenId(makerOrder.conditionId, takerOutcomeIndex);

        ctf.safeTransferFrom(address(this), makerOrder.maker, makerTokenId, fillAmount, "");
        ctf.safeTransferFrom(address(this), msg.sender, takerTokenId, fillAmount, "");

        emit OrderFilled(hashOrder(makerOrder), makerOrder.maker, msg.sender, fillAmount, makerOrder.price);
    }

    // Support ERC1155 receipt
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
