// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AMPool.sol";

/**
 * @title AMPoolFactory
 * @notice Factory for permissionless deployment of AMPool smart contracts.
 */
contract AMPoolFactory {
    // conditionId => poolAddress
    mapping(bytes32 => address) public getPool;
    address[] public allPools;

    event PoolCreated(
        bytes32 indexed conditionId,
        address indexed poolAddress,
        address indexed conditionalTokens,
        uint256 poolIndex
    );

    /**
     * @notice Deploy an AMM pool contract for a given condition.
     */
    function createPool(
        address conditionalTokens,
        bytes32 conditionId,
        address usdcToken,
        address treasury
    ) external returns (address) {
        require(conditionalTokens != address(0), "Invalid tokens contract");
        require(usdcToken != address(0), "Invalid USDC token");
        require(treasury != address(0), "Invalid treasury");
        require(getPool[conditionId] == address(0), "Pool already exists");

        // Deploy new AMM pool contract
        AMPool pool = new AMPool(
            conditionalTokens,
            conditionId,
            usdcToken,
            treasury
        );

        address poolAddress = address(pool);
        getPool[conditionId] = poolAddress;
        allPools.push(poolAddress);

        emit PoolCreated(
            conditionId,
            poolAddress,
            conditionalTokens,
            allPools.length - 1
        );

        return poolAddress;
    }

    /**
     * @notice Get the total count of deployed AMM pools.
     */
    function getPoolsCount() external view returns (uint256) {
        return allPools.length;
    }
}
