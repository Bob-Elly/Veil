// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {VeilPool} from "./VeilPool.sol";
import {IPoseidon2, IPoseidon3} from "./interfaces/IHasher.sol";
import {IVerifier} from "./interfaces/IVerifier.sol";
import {ICviOracle} from "./interfaces/ICviOracle.sol";

/// @title VerifiedVeilPool — "verified mode": only wallets with a valid Cleanverse CVI (A-Pass)
///        may deposit, and withdrawals may only go to CVI-verified wallets. Every note in this pool
///        therefore traces back to a verified identity, while transfers inside the pool stay private.
contract VerifiedVeilPool is VeilPool {
    ICviOracle public immutable cvi;

    error NotVerified(address who);

    constructor(
        IVerifier verifier_,
        IPoseidon2 hasher2_,
        IPoseidon3 hasher3_,
        IERC20 token_,
        uint256 maxDepositAmount_,
        ICviOracle cvi_
    ) VeilPool(verifier_, hasher2_, hasher3_, token_, maxDepositAmount_) {
        cvi = cvi_;
    }

    function _beforeDeposit(address from) internal view override {
        if (!cvi.isVerified(from)) revert NotVerified(from);
    }

    function _beforeWithdraw(address to) internal view override {
        if (!cvi.isVerified(to)) revert NotVerified(to);
    }
}
