// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICviOracle {
    function isVerified(address wallet) external view returns (bool);
}

contract CleanverseCviAdapter is ICviOracle {
    address public attester;
    mapping(address => uint256) public expiries;
    mapping(address => bool) public revoked;

    // Domain separator for EIP-712
    bytes32 public DOMAIN_SEPARATOR;
    bytes32 constant ATTEST_TYPEHASH = keccak256("Attest(address wallet,uint256 expiry)");

    constructor(address _attester) {
        attester = _attester;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("CleanverseCviAdapter")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function isVerified(address wallet) external view returns (bool) {
        return !revoked[wallet] && block.timestamp < expiries[wallet];
    }

    function submitAttestation(address wallet, uint256 expiry, uint8 v, bytes32 r, bytes32 s) external {
        bytes32 structHash = keccak256(abi.encode(ATTEST_TYPEHASH, wallet, expiry));
        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address signer = ecrecover(hash, v, r, s);
        
        require(signer == attester, "Invalid attestation signature");
        require(expiry > block.timestamp, "Attestation already expired");

        expiries[wallet] = expiry;
        revoked[wallet] = false;
    }

    function revoke(address wallet) external {
        require(msg.sender == attester, "Only attester can revoke");
        revoked[wallet] = true;
    }
}
