// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice The seam to Cleanverse CVI (A-Pass). Implemented by a Cleanverse adapter (real attestations)
///         or MockCviOracle (testnet demo). Return true only for a valid, unexpired, unrevoked credential.
interface ICviOracle {
    function isVerified(address wallet) external view returns (bool);
}
