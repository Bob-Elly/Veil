// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICviOracle} from "./interfaces/ICviOracle.sol";

/// @notice Testnet stand-in for Cleanverse CVI. The owner (or an attester key) marks wallets verified,
///         with an expiry. Replace with a Cleanverse adapter once sandbox access is granted.
contract MockCviOracle is ICviOracle {
    address public attester;
    mapping(address => uint64) public expiresAt;

    event Attested(address indexed wallet, uint64 expiresAt);

    constructor(address attester_) {
        attester = attester_;
    }

    function attest(address wallet, uint64 expiry) external {
        require(msg.sender == attester, "not attester");
        expiresAt[wallet] = expiry;
        emit Attested(wallet, expiry);
    }

    function isVerified(address wallet) external view returns (bool) {
        return expiresAt[wallet] > block.timestamp;
    }
}
