// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "openzeppelin-contracts/contracts/proxy/utils/Initializable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

interface IVeilPoolDeposit {
    function depositTo(uint256 pubKey, uint256 amount, uint256 blinding, bytes calldata encryptedOutput)
        external
        returns (uint256 commitment, uint32 index);
    function token() external view returns (IERC20);
}

/// @title StreamVault — one campaign. Pays KOLs per verified X impression (CRE reports) and/or
///        streams salaries per second, always as shielded notes in a VeilPool.
/// @dev Deployed as an EIP-1167 clone by StreamVaultFactory. Funded by a VeilPool WITHDRAWAL whose
///      recipient is this clone, so the project's treasury never appears.
///      Payout notes use a public "plain memo" (amount + blinding) because a contract cannot encrypt.
///      Per-post payouts are therefore public by design; spends stay unlinkable (nullifiers need the KOL's key).
contract StreamVault is Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant FIELD_SIZE =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint16 public constant BPS = 10_000;

    IVeilPoolDeposit public pool;
    IERC20 public token;
    address public admin;          // campaign admin key (a fresh Mera child key per campaign)
    address public forwarder;      // Chainlink CRE KeystoneForwarder (or MockKeystoneForwarder in simulation)
    uint256 public adminPubKey;    // shielded pubKey that receives refunds

    // Impression meter
    uint256 public ratePerThousand; // token units per 1,000 impressions
    uint256 public perPostCap;      // max total payout per post (now + held)
    uint16 public holdbackBps;      // e.g. 2000 = 20% held until minLifetime
    uint64 public minLifetime;      // seconds a post must stay up before holdback is released
    uint64 public endTime;          // campaign end; after it, admin can close and refund

    struct Kol { uint256 pubKey; bool allowed; }
    struct Post {
        uint64 xUserId;
        uint64 lastImpressions;
        uint64 registeredAt;
        uint64 lastValidAt;
        uint256 paid;   // paid now (sum)
        uint256 held;   // held back, not yet released
        bool rejected;  // CRE said: wrong author or no #ad disclosure, or deleted
        bool exists;
    }
    mapping(uint64 => Kol) public kols;      // xUserId → KOL
    mapping(uint256 => Post) public posts;   // X post id → Post
    uint256[] public postIds;
    uint256 public totalHeld;
    uint256 public payoutNonce;

    // Time meter (salaries / subscriptions)
    struct Stream { uint256 pubKey; uint128 ratePerSecond; uint64 start; uint64 end; uint64 lastDrip; }
    Stream[] public streams;

    event KolSet(uint64 indexed xUserId, uint256 pubKey, bool allowed);
    event PostRegistered(uint256 indexed postId, uint64 indexed xUserId);
    event Report(uint256 indexed postId, uint64 impressions, bool valid);
    event Payout(uint256 indexed postId, uint256 pubKey, uint256 amount, uint256 blinding, uint256 commitment, uint32 index, bool holdback);
    event PostRejected(uint256 indexed postId, uint256 forfeited);
    event StreamCreated(uint256 indexed streamId, uint256 pubKey, uint128 ratePerSecond, uint64 start, uint64 end);
    event Drip(uint256 indexed streamId, uint256 amount, uint256 blinding, uint256 commitment, uint32 index);
    event Closed(uint256 refunded);

    error NotAdmin();
    error NotForwarder();
    error UnknownKol();
    error PostExists();
    error NotYet();
    error NothingToPay();
    error BadParams();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    struct Config {
        address pool;
        address admin;
        address forwarder;
        uint256 adminPubKey;
        uint256 ratePerThousand;
        uint256 perPostCap;
        uint16 holdbackBps;
        uint64 minLifetime;
        uint64 endTime;
    }

    function initialize(Config calldata c) external initializer {
        if (c.holdbackBps > BPS || c.adminPubKey >= FIELD_SIZE || c.admin == address(0)) revert BadParams();
        pool = IVeilPoolDeposit(c.pool);
        token = pool.token();
        admin = c.admin;
        forwarder = c.forwarder;
        adminPubKey = c.adminPubKey;
        ratePerThousand = c.ratePerThousand;
        perPostCap = c.perPostCap;
        holdbackBps = c.holdbackBps;
        minLifetime = c.minLifetime;
        endTime = c.endTime;
        token.forceApprove(address(pool), type(uint256).max);
    }

    // ───────── setup ─────────

    function setKol(uint64 xUserId, uint256 pubKey, bool allowed) external onlyAdmin {
        if (pubKey >= FIELD_SIZE) revert BadParams();
        kols[xUserId] = Kol(pubKey, allowed);
        emit KolSet(xUserId, pubKey, allowed);
    }

    /// @notice Anyone (usually the KOL, through the app) registers a post. CRE later checks that
    ///         the post's author is `xUserId` and that it carries the ad disclosure.
    function registerPost(uint256 postId, uint64 xUserId) external {
        if (!kols[xUserId].allowed) revert UnknownKol();
        if (posts[postId].exists) revert PostExists();
        posts[postId] = Post(xUserId, 0, uint64(block.timestamp), 0, 0, 0, false, true);
        postIds.push(postId);
        emit PostRegistered(postId, xUserId);
    }

    function postCount() external view returns (uint256) {
        return postIds.length;
    }

    /// @notice One-call read for the CRE workflow (CRE allows only 15 EVM reads per run).
    ///         Returns up to `limit` non-rejected posts starting at `offset` in registration order.
    function activePosts(uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory ids, uint64[] memory xUserIds, uint64[] memory lastImpressions)
    {
        uint256 n = postIds.length;
        uint256 count;
        for (uint256 i = offset; i < n && count < limit; i++) {
            if (!posts[postIds[i]].rejected) count++;
        }
        ids = new uint256[](count);
        xUserIds = new uint64[](count);
        lastImpressions = new uint64[](count);
        uint256 k;
        for (uint256 i = offset; i < n && k < count; i++) {
            Post storage p = posts[postIds[i]];
            if (p.rejected) continue;
            ids[k] = postIds[i];
            xUserIds[k] = p.xUserId;
            lastImpressions[k] = p.lastImpressions;
            k++;
        }
    }

    // ───────── Chainlink CRE (IReceiver) ─────────

    /// @dev report = abi.encode(uint256[] postIds, uint64[] impressions, bool[] valid)
    ///      valid = author matches AND post contains the disclosure AND post still exists.
    function onReport(bytes calldata, bytes calldata report) external nonReentrant {
        if (msg.sender != forwarder) revert NotForwarder();
        (uint256[] memory ids, uint64[] memory imps, bool[] memory valid) =
            abi.decode(report, (uint256[], uint64[], bool[]));
        if (ids.length != imps.length || ids.length != valid.length) revert BadParams();
        for (uint256 i = 0; i < ids.length; i++) {
            _applyReport(ids[i], imps[i], valid[i]);
        }
    }

    /// @dev ERC-165, required by the CRE KeystoneForwarder (IReceiver interfaceId = onReport selector).
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == this.onReport.selector || id == 0x01ffc9a7;
    }

    function _applyReport(uint256 postId, uint64 impressions, bool valid) internal {
        Post storage p = posts[postId];
        if (!p.exists || p.rejected) return;
        emit Report(postId, impressions, valid);
        if (!valid) {
            p.rejected = true;
            uint256 forfeited = p.held;
            totalHeld -= forfeited;
            p.held = 0;
            emit PostRejected(postId, forfeited);
            return;
        }
        p.lastValidAt = uint64(block.timestamp);
        if (impressions <= p.lastImpressions || block.timestamp > endTime) {
            if (impressions > p.lastImpressions) p.lastImpressions = impressions;
            return;
        }
        uint256 delta = impressions - p.lastImpressions;
        p.lastImpressions = impressions;
        uint256 owed = (delta * ratePerThousand) / 1000;
        uint256 room = perPostCap - (p.paid + p.held);
        if (owed > room) owed = room;
        uint256 free = token.balanceOf(address(this)) - totalHeld;
        if (owed > free) owed = free;
        if (owed == 0) return;
        uint256 hold = (owed * holdbackBps) / BPS;
        uint256 nowAmt = owed - hold;
        p.held += hold;
        totalHeld += hold;
        if (nowAmt > 0) {
            p.paid += nowAmt;
            _pay(postId, kols[p.xUserId].pubKey, nowAmt, false);
        }
    }

    /// @notice Release a post's holdback once it has stayed up for `minLifetime` (anyone can call).
    function releaseHoldback(uint256 postId) external nonReentrant {
        Post storage p = posts[postId];
        if (!p.exists || p.rejected || p.held == 0) revert NothingToPay();
        if (block.timestamp < p.registeredAt + minLifetime || p.lastValidAt < p.registeredAt + minLifetime) revert NotYet();
        uint256 amt = p.held;
        p.held = 0;
        totalHeld -= amt;
        p.paid += amt;
        _pay(postId, kols[p.xUserId].pubKey, amt, true);
    }

    // ───────── time meter ─────────

    function createStream(uint256 pubKey, uint128 ratePerSecond, uint64 start, uint64 end) external onlyAdmin returns (uint256 id) {
        if (pubKey >= FIELD_SIZE || end <= start || ratePerSecond == 0) revert BadParams();
        id = streams.length;
        streams.push(Stream(pubKey, ratePerSecond, start, end, start));
        emit StreamCreated(id, pubKey, ratePerSecond, start, end);
    }

    /// @notice Pay a stream everything accrued since the last drip (anyone can call, e.g. a cron).
    function drip(uint256 streamId) external nonReentrant {
        Stream storage s = streams[streamId];
        uint64 t = uint64(block.timestamp < s.end ? block.timestamp : s.end);
        if (t <= s.lastDrip) revert NothingToPay();
        uint256 amt = uint256(t - s.lastDrip) * s.ratePerSecond;
        uint256 free = token.balanceOf(address(this)) - totalHeld;
        if (amt > free) amt = free;
        if (amt == 0) revert NothingToPay();
        s.lastDrip = t;
        uint256 blinding = _blinding(type(uint256).max - streamId);
        (uint256 c, uint32 idx) = pool.depositTo(s.pubKey, amt, blinding, _plainMemo(amt, blinding));
        emit Drip(streamId, amt, blinding, c, idx);
    }

    // ───────── close ─────────

    /// @notice After endTime: refund everything not held for live posts to the admin's shielded key.
    function close() external onlyAdmin nonReentrant {
        if (block.timestamp <= endTime) revert NotYet();
        uint256 amt = token.balanceOf(address(this)) - totalHeld;
        if (amt == 0) revert NothingToPay();
        uint256 blinding = _blinding(0);
        pool.depositTo(adminPubKey, amt, blinding, _plainMemo(amt, blinding));
        emit Closed(amt);
    }

    // ───────── internals ─────────

    function _pay(uint256 postId, uint256 pubKey, uint256 amt, bool holdback) internal {
        uint256 blinding = _blinding(postId);
        (uint256 c, uint32 idx) = pool.depositTo(pubKey, amt, blinding, _plainMemo(amt, blinding));
        emit Payout(postId, pubKey, amt, blinding, c, idx, holdback);
    }

    function _blinding(uint256 salt) internal returns (uint256) {
        return uint256(keccak256(abi.encode(address(this), salt, payoutNonce++))) % FIELD_SIZE;
    }

    /// @dev "Plain memo" format understood by the SDK scanner: 0x01 || amount (16 bytes) || blinding (32 bytes).
    function _plainMemo(uint256 amt, uint256 blinding) internal pure returns (bytes memory) {
        return abi.encodePacked(bytes1(0x01), uint128(amt), blinding);
    }
}
