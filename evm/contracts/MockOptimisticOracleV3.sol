// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAssertionCallbackRecipient {
    function assertionResolvedCallback(bytes32 assertionId, bool assertedTruthState) external;
}

/**
 * @title MockOptimisticOracleV3
 * @notice Mock implementation of UMA OOv3 for test suites and sandbox executions.
 */
contract MockOptimisticOracleV3 {
    uint256 private assertionNonce;

    struct Assertion {
        bytes32 assertionId;
        bytes claim;
        address callbackRecipient;
        bool resolved;
    }

    mapping(bytes32 => Assertion) public assertions;

    event AssertionMade(bytes32 indexed assertionId, bytes claim, address callbackRecipient);
    event AssertionResolved(bytes32 indexed assertionId, bool assertedTruthState);

    function assertTruthWithDefaults(bytes calldata claim, address callbackRecipient) external returns (bytes32) {
        bytes32 assertionId = keccak256(abi.encodePacked(claim, callbackRecipient, assertionNonce++));
        assertions[assertionId] = Assertion({
            assertionId: assertionId,
            claim: claim,
            callbackRecipient: callbackRecipient,
            resolved: false
        });

        emit AssertionMade(assertionId, claim, callbackRecipient);
        return assertionId;
    }

    function resolveAssertion(bytes32 assertionId, bool assertedTruthState) external {
        Assertion storage assertion = assertions[assertionId];
        require(assertion.assertionId != bytes32(0), "Assertion not found");
        require(!assertion.resolved, "Already resolved");

        assertion.resolved = true;
        IAssertionCallbackRecipient(assertion.callbackRecipient).assertionResolvedCallback(assertionId, assertedTruthState);

        emit AssertionResolved(assertionId, assertedTruthState);
    }
}
