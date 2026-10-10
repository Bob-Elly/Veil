// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VerifiedVeilPool} from "../src/VerifiedVeilPool.sol";
import {VeilPool} from "../src/VeilPool.sol";
import {MockCviOracle} from "../src/MockCviOracle.sol";
import {IPoseidon2, IPoseidon3} from "../src/interfaces/IHasher.sol";
import {IVerifier} from "../src/interfaces/IVerifier.sol";
import {ICviOracle} from "../src/interfaces/ICviOracle.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract VerifiedVeilPoolTest is Test {
    VerifiedVeilPool pool;
    MockCviOracle cvi;
    MockERC20 token;
    address alice = address(0xA);
    address bob = address(0xB);

    function _deployCode(string memory path) internal returns (address a) {
        bytes memory code = vm.parseBytes(vm.readFile(path));
        assembly { a := create(0, add(code, 0x20), mload(code)) }
    }

    function setUp() public {
        token = new MockERC20();
        cvi = new MockCviOracle(address(this));
        pool = new VerifiedVeilPool(
            IVerifier(address(0)),
            IPoseidon2(_deployCode("test/fixtures/poseidon2.hex")),
            IPoseidon3(_deployCode("test/fixtures/poseidon3.hex")),
            IERC20(address(token)),
            1e12,
            ICviOracle(address(cvi))
        );
        token.mint(alice, 100e6);
        token.mint(bob, 100e6);
        vm.prank(alice);
        token.approve(address(pool), type(uint256).max);
        vm.prank(bob);
        token.approve(address(pool), type(uint256).max);
    }

    function test_unverified_cannot_deposit() public {
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(VerifiedVeilPool.NotVerified.selector, bob));
        pool.depositTo(1, 1e6, 2, "");
    }

    function test_verified_can_deposit_until_expiry() public {
        cvi.attest(alice, uint64(block.timestamp + 1 days));
        vm.prank(alice);
        pool.depositTo(1, 1e6, 2, "");
        assertEq(token.balanceOf(address(pool)), 1e6);
        vm.warp(block.timestamp + 2 days);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(VerifiedVeilPool.NotVerified.selector, alice));
        pool.depositTo(1, 1e6, 3, "");
    }
}
