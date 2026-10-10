// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Clones} from "openzeppelin-contracts/contracts/proxy/Clones.sol";
import {StreamVault} from "./StreamVault.sol";

/// @notice Deploys one StreamVault clone per campaign. Predictable address (CREATE2) so the
///         project can fund it with a VeilPool withdrawal before or after creation.
contract StreamVaultFactory {
    address public immutable implementation;
    address[] public vaults;

    event CampaignCreated(address indexed vault, address indexed admin, bytes32 salt);

    constructor() {
        implementation = address(new StreamVault());
    }

    function create(StreamVault.Config calldata c, bytes32 salt) external returns (address vault) {
        vault = Clones.cloneDeterministic(implementation, keccak256(abi.encode(c.admin, salt)));
        StreamVault(vault).initialize(c);
        vaults.push(vault);
        emit CampaignCreated(vault, c.admin, salt);
    }

    function predict(address admin, bytes32 salt) external view returns (address) {
        return Clones.predictDeterministicAddress(implementation, keccak256(abi.encode(admin, salt)));
    }
}
