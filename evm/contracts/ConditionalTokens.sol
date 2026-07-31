// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ConditionalTokens
 * @notice Handles splitting collateral (USDC) into outcome tokens (YES/NO/etc)
 * and redeeming the winning outcome tokens for collateral post-resolution.
 */
contract ConditionalTokens is ERC1155, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable collateralToken;
    address public immutable marketFactory;

    // conditionId => resolved (true/false)
    mapping(bytes32 => bool) public isResolved;
    // conditionId => winningOutcomeIndex
    mapping(bytes32 => uint256) public winningOutcome;
    // conditionId => total outcome count
    mapping(bytes32 => uint256) public outcomeCounts;

    event PositionSplit(
        address indexed stakeholder,
        bytes32 indexed conditionId,
        uint256 amount,
        uint256 outcomeCount
    );

    event PositionMerged(
        address indexed stakeholder,
        bytes32 indexed conditionId,
        uint256 amount,
        uint256 outcomeCount
    );

    event PositionRedeemed(
        address indexed stakeholder,
        bytes32 indexed conditionId,
        uint256 winningOutcomeIndex,
        uint256 amount
    );

    modifier onlyFactory() {
        require(msg.sender == marketFactory, "Only MarketFactory authorized");
        _;
    }

    constructor(address _collateralToken, address _marketFactory) ERC1155("") {
        require(_collateralToken != address(0), "Invalid collateral");
        require(_marketFactory != address(0), "Invalid factory");
        collateralToken = IERC20(_collateralToken);
        marketFactory = _marketFactory;
    }

    /**
     * @notice Helper to generate ERC1155 token IDs from conditionId and outcome index.
     */
    function getTokenId(bytes32 conditionId, uint256 outcomeIndex) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(conditionId, outcomeIndex)));
    }

    /**
     * @notice Register a new condition outcome count (called by factory).
     */
    function registerCondition(bytes32 conditionId, uint256 outcomeCount) external onlyFactory {
        require(outcomeCounts[conditionId] == 0, "Condition already registered");
        require(outcomeCount >= 2, "Outcome count must be at least 2");
        outcomeCounts[conditionId] = outcomeCount;
    }

    /**
     * @notice Split collateral token into N outcome tokens.
     * User pays amount of USDC, receives amount of all N outcome tokens.
     */
    function splitPosition(bytes32 conditionId, uint256 amount) external nonReentrant {
        uint256 count = outcomeCounts[conditionId];
        require(count > 0, "Condition not registered");
        require(!isResolved[conditionId], "Condition already resolved");
        require(amount > 0, "Amount must be positive");

        // Lock collateral
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);

        // Mint outcome tokens to user
        uint256[] memory ids = new uint256[](count);
        uint256[] memory amounts = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            ids[i] = getTokenId(conditionId, i);
            amounts[i] = amount;
        }

        _mintBatch(msg.sender, ids, amounts, "");

        emit PositionSplit(msg.sender, conditionId, amount, count);
    }

    /**
     * @notice Merge N outcome tokens back into collateral.
     * User burns amount of all N outcome tokens, receives amount of USDC.
     */
    function mergePositions(bytes32 conditionId, uint256 amount) external nonReentrant {
        uint256 count = outcomeCounts[conditionId];
        require(count > 0, "Condition not registered");
        require(amount > 0, "Amount must be positive");

        // Burn outcome tokens from user
        uint256[] memory ids = new uint256[](count);
        uint256[] memory amounts = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            ids[i] = getTokenId(conditionId, i);
            amounts[i] = amount;
        }

        _burnBatch(msg.sender, ids, amounts);

        // Release collateral
        collateralToken.safeTransfer(msg.sender, amount);

        emit PositionMerged(msg.sender, conditionId, amount, count);
    }

    /**
     * @notice Resolve the condition (called by factory).
     */
    function resolveCondition(bytes32 conditionId, uint256 winningOutcomeIndex) external onlyFactory {
        require(outcomeCounts[conditionId] > 0, "Condition not registered");
        require(!isResolved[conditionId], "Condition already resolved");
        require(winningOutcomeIndex < outcomeCounts[conditionId], "Invalid winning index");

        isResolved[conditionId] = true;
        winningOutcome[conditionId] = winningOutcomeIndex;
    }

    /**
     * @notice Redeem winning outcome tokens for collateral.
     * User burns amount of winning outcome tokens, receives amount of USDC.
     */
    function redeemPositions(bytes32 conditionId, uint256 amount) external nonReentrant {
        require(isResolved[conditionId], "Condition not resolved yet");
        require(amount > 0, "Amount must be positive");

        uint256 winningId = getTokenId(conditionId, winningOutcome[conditionId]);

        // Burn winning token
        _burn(msg.sender, winningId, amount);

        // Send collateral to user
        collateralToken.safeTransfer(msg.sender, amount);

        emit PositionRedeemed(msg.sender, conditionId, winningOutcome[conditionId], amount);
    }
}
