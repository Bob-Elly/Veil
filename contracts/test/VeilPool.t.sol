// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VeilPool} from "../src/VeilPool.sol";
import {IPoseidon2, IPoseidon3} from "../src/interfaces/IHasher.sol";
import {IVerifier} from "../src/interfaces/IVerifier.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract MockVerifier is IVerifier {
    bool public shouldVerify = true;

    function setShouldVerify(bool _s) external {
        shouldVerify = _s;
    }

    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[7] calldata
    ) external view returns (bool) {
        return shouldVerify;
    }
}

contract VeilPoolTest is Test {
    VeilPool pool;
    MockERC20 usdc;
    MockVerifier verifier;
    uint256 constant D = 1e6;

    function _deployCode(string memory path) internal returns (address a) {
        bytes memory code = vm.parseBytes(vm.readFile(path));
        assembly { a := create(0, add(code, 0x20), mload(code)) }
        require(a != address(0), "deploy failed");
    }

    function setUp() public {
        IPoseidon2 p2 = IPoseidon2(_deployCode("test/fixtures/poseidon2.hex"));
        IPoseidon3 p3 = IPoseidon3(_deployCode("test/fixtures/poseidon3.hex"));
        usdc = new MockERC20();
        verifier = new MockVerifier();
        pool = new VeilPool(verifier, p2, p3, IERC20(address(usdc)), 10_000 * D);
    }

    function test_transact_reverts_UnknownRoot() public {
        VeilPool.ExtData memory extData = VeilPool.ExtData({
            recipient: address(0),
            extAmount: 0,
            relayer: address(0),
            fee: 0,
            encryptedOutput1: "",
            encryptedOutput2: ""
        });
        
        VeilPool.Proof memory proof;
        proof.root = 12345; // random unknown root
        proof.extDataHash = pool.hashExtData(extData);
        proof.publicAmount = pool.calculatePublicAmount(extData.extAmount, extData.fee);

        vm.expectRevert(VeilPool.UnknownRoot.selector);
        pool.transact(proof, extData);
    }

    function test_BadPublicAmount() public {
        VeilPool.ExtData memory extData = VeilPool.ExtData({
            recipient: address(0),
            extAmount: 0,
            relayer: address(0),
            fee: 0,
            encryptedOutput1: "",
            encryptedOutput2: ""
        });

        VeilPool.Proof memory proof;
        proof.root = pool.currentRoot(); // known root
        proof.extDataHash = pool.hashExtData(extData);
        proof.publicAmount = 999; // Incorrect public amount

        vm.expectRevert(VeilPool.BadPublicAmount.selector);
        pool.transact(proof, extData);
    }

    function test_DepositTooLarge() public {
        VeilPool.ExtData memory extData = VeilPool.ExtData({
            recipient: address(0),
            extAmount: int256(20_000 * D),
            relayer: address(0),
            fee: 0,
            encryptedOutput1: "",
            encryptedOutput2: ""
        });

        VeilPool.Proof memory proof;

        vm.expectRevert(VeilPool.DepositTooLarge.selector);
        pool.transact(proof, extData);
        
        // Also check for depositTo
        vm.expectRevert(VeilPool.DepositTooLarge.selector);
        pool.depositTo(12345, 20_000 * D, 54321, "");
    }

    function test_DepositsArePaused() public {
        pool.setDepositsPaused(true);

        VeilPool.ExtData memory extData = VeilPool.ExtData({
            recipient: address(0),
            extAmount: int256(1_000 * D),
            relayer: address(0),
            fee: 0,
            encryptedOutput1: "",
            encryptedOutput2: ""
        });

        VeilPool.Proof memory proof;

        vm.expectRevert(VeilPool.DepositsArePaused.selector);
        pool.transact(proof, extData);
        
        vm.expectRevert(VeilPool.DepositsArePaused.selector);
        pool.depositTo(12345, 1_000 * D, 54321, "");
        
        // withdrawals must still work while paused
        extData.extAmount = -int256(1_000 * D);
        extData.recipient = address(this);
        
        proof.root = pool.currentRoot();
        proof.extDataHash = pool.hashExtData(extData);
        proof.publicAmount = pool.calculatePublicAmount(extData.extAmount, extData.fee);
        
        usdc.mint(address(pool), 1_000 * D); // Give pool funds for withdrawal
        
        pool.transact(proof, extData); // should succeed, verifier returns true
    }

    function test_ZeroRecipient() public {
        VeilPool.ExtData memory extData = VeilPool.ExtData({
            recipient: address(0),
            extAmount: -int256(1_000 * D),
            relayer: address(0),
            fee: 0,
            encryptedOutput1: "",
            encryptedOutput2: ""
        });
        VeilPool.Proof memory proof;
        proof.root = pool.currentRoot();
        proof.extDataHash = pool.hashExtData(extData);
        proof.publicAmount = pool.calculatePublicAmount(extData.extAmount, extData.fee);
        vm.expectRevert(VeilPool.ZeroRecipient.selector);
        pool.transact(proof, extData);
    }

    function test_ZeroRelayer() public {
        VeilPool.ExtData memory extData = VeilPool.ExtData({
            recipient: address(this),
            extAmount: 0,
            relayer: address(0),
            fee: 10 * D,
            encryptedOutput1: "",
            encryptedOutput2: ""
        });
        VeilPool.Proof memory proof;
        proof.root = pool.currentRoot();
        proof.extDataHash = pool.hashExtData(extData);
        proof.publicAmount = pool.calculatePublicAmount(extData.extAmount, extData.fee);
        vm.expectRevert(VeilPool.ZeroRelayer.selector);
        pool.transact(proof, extData);
    }

    function test_ZerosAndRoot() public {
        uint256 expectedRoot = pool.zeros(20);
        assertEq(pool.currentRoot(), expectedRoot);
    }

    function testFuzz_InvariantDepositTo(uint256[] memory amounts) public {
        uint256 total = 0;
        for(uint256 i = 0; i < amounts.length; i++) {
            uint256 amt = amounts[i] % pool.maxDepositAmount();
            if (amt == 0) continue;
            usdc.mint(address(this), amt);
            usdc.approve(address(pool), amt);
            pool.depositTo(12345, amt, 54321, "");
            total += amt;
            if (i > 10) break; // limit gas for fuzzing
        }
        assertEq(usdc.balanceOf(address(pool)), total);
    }
}
