// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {MerkleTreeWithHistory} from "./MerkleTreeWithHistory.sol";
import {IPoseidon2, IPoseidon3} from "./interfaces/IHasher.sol";
import {IVerifier} from "./interfaces/IVerifier.sol";

/// @title VeilPool — shielded pool for ONE ERC-20 (deploy one per asset).
/// @notice Notes are owned by a key: commitment = Poseidon(amount, pubKey, blinding).
///         `transact` spends 2 notes and creates 2 notes with a Groth16 proof; it also handles
///         deposits (extAmount > 0) and withdrawals (extAmount < 0).
///         `depositTo` lets a contract or person create a note for someone else's pubKey without a
///         proof: the pool computes the commitment itself, so the amount is always bound
///         (cf. Gloam audit H-P1/C1, where a client-supplied commitment drained the pool).
/// @dev Nobody, including the owner, can move pooled funds. Owner can only pause deposits and set limits.
contract VeilPool is MerkleTreeWithHistory, ReentrancyGuard {
    using SafeERC20 for IERC20;

    int256 public constant MAX_EXT_AMOUNT = 2 ** 120;
    uint256 public constant MAX_FEE = 2 ** 120;
    uint256 public constant MAX_NOTE_AMOUNT = 2 ** 128; // matches Num2Bits(128) in the circuit

    IVerifier public immutable verifier;
    IPoseidon3 public immutable hasher3;
    IERC20 public immutable token;

    address public owner;
    address public pendingOwner;
    bool public depositsPaused;
    uint256 public maxDepositAmount; // per transaction; mainnet beta cap

    mapping(uint256 => bool) public nullifierHashes;

    struct ExtData {
        address recipient;   // withdrawal recipient (0 if none)
        int256 extAmount;    // > 0 deposit, < 0 withdrawal, 0 private transfer
        address relayer;     // gets `fee` (0 if none)
        uint256 fee;         // paid out of the pool in `token` to `relayer`
        bytes encryptedOutput1;
        bytes encryptedOutput2;
    }

    struct Proof {
        uint256[2] a;
        uint256[2][2] b; // already in Solidity order (G2 coordinates swapped vs snarkjs JSON)
        uint256[2] c;
        uint256 root;
        uint256 publicAmount;
        uint256 extDataHash;
        uint256[2] inputNullifiers;
        uint256[2] outputCommitments;
    }

    event NewCommitment(uint256 commitment, uint256 index, bytes encryptedOutput);
    event NewNullifier(uint256 nullifier);
    event DepositsPaused(bool paused);
    event MaxDepositAmountSet(uint256 amount);
    event OwnershipTransferStarted(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotOwner();
    error NotPendingOwner();
    error UnknownRoot();
    error NullifierAlreadySpent();
    error BadExtDataHash();
    error BadPublicAmount();
    error InvalidProof();
    error InvalidExtAmount();
    error InvalidFee();
    error DepositsArePaused();
    error DepositTooLarge();
    error ZeroRecipient();
    error ZeroRelayer();
    error FeeOnTransferToken();
    error InvalidNote();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(
        IVerifier verifier_,
        IPoseidon2 hasher2_,
        IPoseidon3 hasher3_,
        IERC20 token_,
        uint256 maxDepositAmount_
    ) MerkleTreeWithHistory(hasher2_) {
        verifier = verifier_;
        hasher3 = hasher3_;
        token = token_;
        maxDepositAmount = maxDepositAmount_;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ───────────────────────────── core ─────────────────────────────

    function transact(Proof calldata proof, ExtData calldata extData) external nonReentrant {
        if (extData.extAmount > 0) {
            if (depositsPaused) revert DepositsArePaused();
            if (uint256(extData.extAmount) > maxDepositAmount) revert DepositTooLarge();
            _beforeDeposit(msg.sender);
            _pull(msg.sender, uint256(extData.extAmount));
        }

        _transact(proof, extData);

        if (extData.extAmount < 0) {
            if (extData.recipient == address(0)) revert ZeroRecipient();
            _beforeWithdraw(extData.recipient);
            token.safeTransfer(extData.recipient, uint256(-extData.extAmount));
        }
        if (extData.fee > 0) {
            if (extData.relayer == address(0)) revert ZeroRelayer();
            token.safeTransfer(extData.relayer, extData.fee);
        }
    }

    /// @notice Create a note for `pubKey` from the caller's tokens. No proof: the pool hashes the
    ///         commitment itself, so `amount` is exactly what was paid in.
    /// @dev Reveals that `pubKey` received `amount`. Spending stays unlinkable (nullifiers need the
    ///      private key). Use a fresh pubKey per payer/campaign where that matters.
    function depositTo(uint256 pubKey, uint256 amount, uint256 blinding, bytes calldata encryptedOutput)
        external
        nonReentrant
        returns (uint256 commitment, uint32 index)
    {
        if (depositsPaused) revert DepositsArePaused();
        if (amount == 0 || amount >= MAX_NOTE_AMOUNT) revert InvalidNote();
        if (amount > maxDepositAmount) revert DepositTooLarge();
        if (pubKey >= FIELD_SIZE || blinding >= FIELD_SIZE) revert ValueOutOfField();
        _beforeDeposit(msg.sender);
        _pull(msg.sender, amount);
        commitment = hasher3.poseidon([amount, pubKey, blinding]);
        index = _insert(commitment);
        emit NewCommitment(commitment, index, encryptedOutput);
    }

    function calculatePublicAmount(int256 extAmount, uint256 fee) public pure returns (uint256) {
        if (fee >= MAX_FEE) revert InvalidFee();
        if (extAmount <= -MAX_EXT_AMOUNT || extAmount >= MAX_EXT_AMOUNT) revert InvalidExtAmount();
        int256 publicAmount = extAmount - int256(fee);
        return publicAmount >= 0 ? uint256(publicAmount) : FIELD_SIZE - uint256(-publicAmount);
    }

    function hashExtData(ExtData calldata extData) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(extData))) % FIELD_SIZE;
    }

    function isSpent(uint256 nullifierHash) external view returns (bool) {
        return nullifierHashes[nullifierHash];
    }

    function _transact(Proof calldata proof, ExtData calldata extData) internal {
        if (!isKnownRoot(proof.root)) revert UnknownRoot();
        for (uint256 i = 0; i < 2; i++) {
            if (nullifierHashes[proof.inputNullifiers[i]]) revert NullifierAlreadySpent();
        }
        if (proof.extDataHash != hashExtData(extData)) revert BadExtDataHash();
        if (proof.publicAmount != calculatePublicAmount(extData.extAmount, extData.fee)) revert BadPublicAmount();
        if (!_verify(proof)) revert InvalidProof();

        for (uint256 i = 0; i < 2; i++) {
            nullifierHashes[proof.inputNullifiers[i]] = true;
            emit NewNullifier(proof.inputNullifiers[i]);
        }
        uint32 i0 = _insert(proof.outputCommitments[0]);
        uint32 i1 = _insert(proof.outputCommitments[1]);
        emit NewCommitment(proof.outputCommitments[0], i0, extData.encryptedOutput1);
        emit NewCommitment(proof.outputCommitments[1], i1, extData.encryptedOutput2);
    }

    function _verify(Proof calldata p) internal view returns (bool) {
        uint256[7] memory pub = [
            p.root,
            p.publicAmount,
            p.extDataHash,
            p.inputNullifiers[0],
            p.inputNullifiers[1],
            p.outputCommitments[0],
            p.outputCommitments[1]
        ];
        return verifier.verifyProof(p.a, p.b, p.c, pub);
    }

    /// @dev Compliance hooks. Empty here; VerifiedVeilPool overrides them (Cleanverse CVI gate).
    ///      Called where value crosses the pool boundary: who pays in, who gets paid out.
    function _beforeDeposit(address from) internal view virtual {}

    function _beforeWithdraw(address to) internal view virtual {}

    function _pull(address from, uint256 amount) internal {
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        if (token.balanceOf(address(this)) - before != amount) revert FeeOnTransferToken();
    }

    // ───────────────────────────── admin (cannot touch funds) ─────────────────────────────

    function setDepositsPaused(bool paused) external onlyOwner {
        depositsPaused = paused;
        emit DepositsPaused(paused);
    }

    function setMaxDepositAmount(uint256 amount) external onlyOwner {
        maxDepositAmount = amount;
        emit MaxDepositAmountSet(amount);
    }

    function transferOwnership(address to) external onlyOwner {
        pendingOwner = to;
        emit OwnershipTransferStarted(owner, to);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }
}
