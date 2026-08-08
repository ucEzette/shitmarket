// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ConditionalTokens.sol";
import "./OracleRegistry.sol";

/**
 * @title MarketFactory
 * @notice Factory for creating and resolving decentralized prediction markets.
 */
contract MarketFactory is Ownable {
    using SafeERC20 for IERC20;

    struct Market {
        uint256 marketId;
        bytes32 conditionId;
        string ipfsHash;
        uint256 outcomeCount;
        address oracle;
        uint256 resolutionTime;
        bool resolved;
        uint256 resolvedOutcomeIndex;
    }

    IERC20 public immutable usdcToken;
    ConditionalTokens public immutable conditionalTokens;
    address public treasury;
    uint256 public creationFee = 3 * 10**6; // 3 USDC creation fee

    uint256 public marketCount;
    mapping(uint256 => Market) public markets;
    mapping(bytes32 => uint256) public conditionToMarketId;

    event MarketCreated(
        uint256 indexed marketId,
        bytes32 indexed conditionId,
        address indexed creator,
        string ipfsHash,
        uint256 outcomeCount,
        address oracle,
        uint256 resolutionTime
    );

    event MarketResolved(
        uint256 indexed marketId,
        uint256 winningOutcomeIndex
    );

    constructor(address _usdcToken, address _treasury) Ownable(msg.sender) {
        require(_usdcToken != address(0), "Invalid USDC");
        require(_treasury != address(0), "Invalid treasury");
        usdcToken = IERC20(_usdcToken);
        treasury = _treasury;

        // Deploy the ConditionalTokens contract pointing to this factory
        conditionalTokens = new ConditionalTokens(_usdcToken, address(this));
    }

    /**
     * @notice Create a new prediction market.
     * Anyone can create a market by paying a small fee.
     */
    function createMarket(
        string calldata ipfsHash,
        uint256 outcomeCount,
        address oracle,
        uint256 resolutionTime,
        address customResolver // Optional EOA resolver for self-sovereign oracles
    ) external returns (uint256) {
        require(outcomeCount >= 2, "Outcome count must be at least 2");
        require(resolutionTime > block.timestamp, "Invalid resolution time");
        require(oracle != address(0), "Invalid oracle address");

        // Collect creation fee to deter spam
        if (creationFee > 0) {
            usdcToken.safeTransferFrom(msg.sender, treasury, creationFee);
        }

        uint256 marketId = marketCount++;
        bytes32 conditionId = keccak256(abi.encodePacked(address(this), marketId, outcomeCount));

        markets[marketId] = Market({
            marketId: marketId,
            conditionId: conditionId,
            ipfsHash: ipfsHash,
            outcomeCount: outcomeCount,
            oracle: oracle,
            resolutionTime: resolutionTime,
            resolved: false,
            resolvedOutcomeIndex: 0
        });

        conditionToMarketId[conditionId] = marketId;

        // Register the condition on the ConditionalTokens contract
        conditionalTokens.registerCondition(conditionId, outcomeCount);

        // If custom resolver EOA is specified, register it in the OracleRegistry
        if (customResolver != address(0)) {
            OracleRegistry(oracle).setCustomResolver(marketId, customResolver);
        }

        emit MarketCreated(
            marketId,
            conditionId,
            msg.sender,
            ipfsHash,
            outcomeCount,
            oracle,
            resolutionTime
        );

        return marketId;
    }

    /**
     * @notice Resolve prediction market outcome against the registered Oracle contract.
     */
    function resolveMarket(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(!market.resolved, "Market already resolved");
        require(block.timestamp >= market.resolutionTime, "Resolution time not reached yet");

        // Call the oracle adapter to query if the outcome is ready
        (bool ready, uint256 winningOutcomeIndex) = IOracle(market.oracle).getOutcome(marketId);
        require(ready, "Oracle outcome not ready");
        require(winningOutcomeIndex < market.outcomeCount, "Invalid oracle outcome index");

        market.resolved = true;
        market.resolvedOutcomeIndex = winningOutcomeIndex;

        // Propagate resolution to ConditionalTokens contract to unlock redemptions
        conditionalTokens.resolveCondition(market.conditionId, winningOutcomeIndex);

        emit MarketResolved(marketId, winningOutcomeIndex);
    }

    /**
     * @notice Update treasury destination
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    /**
     * @notice Update creation fee
     */
    function setCreationFee(uint256 _fee) external onlyOwner {
        creationFee = _fee;
    }
}
