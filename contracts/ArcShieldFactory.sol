// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ArcShield.sol";

/**
 * @title ArcShieldFactory
 * @dev Factory contract to deploy individual, isolated ArcShield guardrails for AI agents.
 */
contract ArcShieldFactory {
    event ShieldCreated(
        address indexed owner,
        address indexed shieldAddress,
        address indexed agent,
        address usdc,
        uint256 dailyLimit,
        uint256 maxTxAmount
    );

    // Array to store all deployed shields
    address[] public allShields;

    // Mapping to store shields by owner address
    mapping(address => address[]) public ownerToShields;

    /**
     * @dev Deploys a new ArcShield instance.
     * @param agent The authorized AI agent address.
     * @param usdc The USDC token address on Arc.
     * @param dailyLimit The daily spending limit (in 6 decimals).
     * @param maxTxAmount The maximum single transaction limit (in 6 decimals).
     * @return The address of the newly deployed ArcShield contract.
     */
    function createShield(
        address agent,
        address usdc,
        uint256 dailyLimit,
        uint256 maxTxAmount
    ) external returns (address) {
        ArcShield newShield = new ArcShield(
            msg.sender,
            agent,
            usdc,
            dailyLimit,
            maxTxAmount
        );

        address shieldAddress = address(newShield);

        allShields.push(shieldAddress);
        ownerToShields[msg.sender].push(shieldAddress);

        emit ShieldCreated(
            msg.sender,
            shieldAddress,
            agent,
            usdc,
            dailyLimit,
            maxTxAmount
        );

        return shieldAddress;
    }

    /**
     * @dev Returns the total number of shields deployed.
     */
    function getShieldsCount() external view returns (uint256) {
        return allShields.length;
    }

    /**
     * @dev Returns all shields deployed for a specific owner.
     */
    function getOwnerShields(address owner) external view returns (address[] memory) {
        return ownerToShields[owner];
    }
}
