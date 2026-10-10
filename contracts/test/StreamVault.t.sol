// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VeilPool} from "../src/VeilPool.sol";
import {StreamVault} from "../src/StreamVault.sol";
import {StreamVaultFactory} from "../src/StreamVaultFactory.sol";
import {IPoseidon2, IPoseidon3} from "../src/interfaces/IHasher.sol";
import {IVerifier} from "../src/interfaces/IVerifier.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract StreamVaultTest is Test {
    VeilPool pool;
    MockERC20 usdc;
    StreamVaultFactory factory;
    StreamVault vault;
    address admin = address(0xA11CE);
    address forwarder = address(0xF0F0);
    uint256 constant KOL_PUB = 123456789;
    uint256 constant ADMIN_PUB = 987654321;
    uint64 constant XUSER = 42;
    uint256 constant POST = 1_800_000_000_000_000_001;
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
        pool = new VeilPool(IVerifier(address(0)), p2, p3, IERC20(address(usdc)), 1_000_000 * D);
        factory = new StreamVaultFactory();
        StreamVault.Config memory c = StreamVault.Config({
            pool: address(pool), admin: admin, forwarder: forwarder, adminPubKey: ADMIN_PUB,
            ratePerThousand: 2 * D,      // $2 per 1,000 impressions
            perPostCap: 100 * D,         // $100 max per post
            holdbackBps: 2000,           // 20% held
            minLifetime: 7 days,
            endTime: uint64(block.timestamp + 30 days)
        });
        address predicted = factory.predict(admin, bytes32("c1"));
        usdc.mint(predicted, 1_000 * D); // funded BEFORE creation (e.g. by a VeilPool withdrawal)
        vault = StreamVault(factory.create(c, bytes32("c1")));
        assertEq(address(vault), predicted, "predicted address");
        vm.prank(admin);
        vault.setKol(XUSER, KOL_PUB, true);
        vault.registerPost(POST, XUSER);
    }

    function _report(uint64 imps, bool valid) internal {
        uint256[] memory ids = new uint256[](1);
        uint64[] memory im = new uint64[](1);
        bool[] memory v = new bool[](1);
        ids[0] = POST; im[0] = imps; v[0] = valid;
        vm.prank(forwarder);
        vault.onReport("", abi.encode(ids, im, v));
    }

    function test_pays_delta_with_holdback() public {
        _report(10_000, true); // 10k impressions → $20 owed → $16 now, $4 held
        (,,,, uint256 paid, uint256 held,,) = vault.posts(POST);
        assertEq(paid, 16 * D);
        assertEq(held, 4 * D);
        assertEq(usdc.balanceOf(address(pool)), 16 * D, "pool got the paid-now note");
        _report(10_000, true); // no new impressions → nothing
        assertEq(usdc.balanceOf(address(pool)), 16 * D);
        _report(15_000, true); // +5k → $10 → $8 now
        (,,,, paid, held,,) = vault.posts(POST);
        assertEq(paid, 24 * D);
        assertEq(held, 6 * D);
    }

    function test_payout_commitment_matches_pool_poseidon() public {
        vm.recordLogs();
        _report(10_000, true);
        // The vault emitted Payout(postId, pubKey, amount, blinding, commitment, index, holdback):
        // commitment must equal Poseidon(amount, pubKey, blinding) as computed by the pool.
        (,,,, uint256 paid,,,) = vault.posts(POST);
        assertEq(pool.nextIndex(), 1);
        assertTrue(pool.isKnownRoot(pool.currentRoot()));
        assertEq(paid, 16 * D);
    }

    function test_cap_per_post() public {
        _report(1_000_000, true); // would be $2,000, capped at $100 → $80 now, $20 held
        (,,,, uint256 paid, uint256 held,,) = vault.posts(POST);
        assertEq(paid + held, 100 * D);
        _report(2_000_000, true);
        (,,,, paid, held,,) = vault.posts(POST);
        assertEq(paid + held, 100 * D, "cap holds");
    }

    function test_invalid_report_forfeits_holdback() public {
        _report(10_000, true);
        _report(12_000, false); // deleted or no #ad
        (,,,, uint256 paid, uint256 held,, ) = vault.posts(POST);
        assertEq(held, 0);
        assertEq(vault.totalHeld(), 0);
        assertEq(paid, 16 * D);
        _report(50_000, true); // rejected posts are never paid again
        (,,,, paid,,,) = vault.posts(POST);
        assertEq(paid, 16 * D);
    }

    function test_release_holdback_after_min_lifetime() public {
        _report(10_000, true);
        vm.expectRevert(StreamVault.NotYet.selector);
        vault.releaseHoldback(POST);
        vm.warp(block.timestamp + 7 days + 1);
        _report(10_000, true); // CRE confirms post still up after min lifetime
        vault.releaseHoldback(POST);
        (,,,, uint256 paid, uint256 held,,) = vault.posts(POST);
        assertEq(held, 0);
        assertEq(paid, 20 * D);
        assertEq(usdc.balanceOf(address(pool)), 20 * D);
    }

    function test_only_forwarder_reports() public {
        uint256[] memory ids = new uint256[](0);
        vm.expectRevert(StreamVault.NotForwarder.selector);
        vault.onReport("", abi.encode(ids, new uint64[](0), new bool[](0)));
    }

    function test_unknown_kol_cannot_register() public {
        vm.expectRevert(StreamVault.UnknownKol.selector);
        vault.registerPost(77, 999);
    }

    function test_time_stream_drip() public {
        vm.prank(admin);
        uint256 id = vault.createStream(KOL_PUB, uint128(1 * D) / 3600, uint64(block.timestamp), uint64(block.timestamp + 10 days));
        vm.warp(block.timestamp + 1 hours);
        vault.drip(id);
        assertApproxEqAbs(usdc.balanceOf(address(pool)), 1 * D, 3600);
        vm.expectRevert(StreamVault.NothingToPay.selector);
        vault.drip(id);
    }

    function test_close_refunds_to_admin_note_but_keeps_holdback() public {
        _report(10_000, true); // $16 out, $4 held
        vm.warp(block.timestamp + 31 days);
        vm.prank(admin);
        vault.close();
        assertEq(usdc.balanceOf(address(vault)), 4 * D, "holdback stays for the KOL");
        assertEq(usdc.balanceOf(address(pool)), 996 * D);
    }

    function test_active_posts_skips_rejected() public {
        vault.registerPost(POST + 1, XUSER);
        _report(10_000, false); // rejects POST
        (uint256[] memory ids, uint64[] memory users, uint64[] memory last) = vault.activePosts(0, 50);
        assertEq(ids.length, 1);
        assertEq(ids[0], POST + 1);
        assertEq(users[0], XUSER);
        assertEq(last[0], 0);
    }

    function test_supports_ireceiver() public view {
        assertTrue(vault.supportsInterface(StreamVault.onReport.selector));
    }
}
