// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./OracleRegistry.sol";

interface IOptimisticOracleV3 {
    function assertTruthWithDefaults(bytes calldata claim, address callbackRecipient) external returns (bytes32 assertionId);
}

/**
 * @title UmaOracleAdapter
 * @notice Resolves ShitMarket rooms using UMA's Optimistic Oracle v3 (OOv3).
 */
contract UmaOracleAdapter is Ownable, IOracle {
    
    IOptimisticOracleV3 public immutable optimisticOracle;
    
    // marketId => outcomeIndex proposed
    mapping(uint256 => uint256) public proposedOutcomes;
    // marketId => assertionId generated
    mapping(uint256 => bytes32) public marketAssertions;
    // assertionId => marketId
    mapping(bytes32 => uint256) public assertionMarkets;
    // marketId => ready status
    mapping(uint256 => bool) public resolvedMarkets;
    // marketId => final outcome
    mapping(uint256 => uint256) public finalOutcomes;

    event MarketOutcomeAsserted(uint256 indexed marketId, bytes32 indexed assertionId, uint256 outcomeIndex, string claim);
    event MarketOutcomeResolved(uint256 indexed marketId, uint256 outcomeIndex, bool assertedTruthState);

    constructor(address _optimisticOracle) Ownable(msg.sender) {
        require(_optimisticOracle != address(0), "Invalid UMA oracle address");
        optimisticOracle = IOptimisticOracleV3(_optimisticOracle);
    }

    /**
     * @notice Assert an outcome for a market to UMA OOv3.
     */
    function assertOutcome(uint256 marketId, uint256 outcomeIndex, string calldata claim) external returns (bytes32) {
        require(marketAssertions[marketId] == bytes32(0), "Outcome already asserted");
        require(!resolvedMarkets[marketId], "Market already resolved");

        bytes32 assertionId = optimisticOracle.assertTruthWithDefaults(bytes(claim), address(this));
        
        proposedOutcomes[marketId] = outcomeIndex;
        marketAssertions[marketId] = assertionId;
        assertionMarkets[assertionId] = marketId;

        emit MarketOutcomeAsserted(marketId, assertionId, outcomeIndex, claim);
        return assertionId;
    }

    /**
     * @notice Callback called by UMA OOv3 when assertion is resolved.
     */
    function assertionResolvedCallback(bytes32 assertionId, bool assertedTruthState) external {
        require(msg.sender == address(optimisticOracle), "Only UMA OOv3 can call callback");
        uint256 marketId = assertionMarkets[assertionId];
        require(marketId != 0, "No matching market found");
        require(!resolvedMarkets[marketId], "Market already resolved");

        resolvedMarkets[marketId] = true;
        if (assertedTruthState) {
            finalOutcomes[marketId] = proposedOutcomes[marketId];
        } else {
            // Overturned: outcome becomes the opposite side (binary 0 <-> 1 swap)
            finalOutcomes[marketId] = proposedOutcomes[marketId] == 0 ? 1 : 0;
        }

        emit MarketOutcomeResolved(marketId, finalOutcomes[marketId], assertedTruthState);
    }

    /**
     * @notice IOracle interface compliance to return ready status and outcome index.
     */
    function getOutcome(uint256 marketId) external view override returns (bool ready, uint256 outcomeIndex) {
        return (resolvedMarkets[marketId], finalOutcomes[marketId]);
    }
}
