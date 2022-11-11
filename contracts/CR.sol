// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "hardhat/console.sol";


contract CR {
    bytes constant public ETH_PREFIX = "\x19Ethereum Signed Message:\n32";
    uint256 b;

    struct FirstClassData {
        uint224 value;
        uint32 dataTimestamp;
    }

    mapping(bytes32 => FirstClassData) public fcdsT;
    mapping(bytes32 => uint256) public fcds;

    constructor() {
        b=1;
        fcds[bytes32(0x4500000000000000000000000000000000000000000000000000000000000000)] = 123_987;
    }

    function recoverSigner(bytes32 _affidavit, uint8 _v, bytes32 _r, bytes32 _s) internal pure returns (address) {
        bytes32 hash = keccak256(abi.encodePacked(ETH_PREFIX, _affidavit));
        return ecrecover(hash, _v, _r, _s);
    }

    function submitOneFcd(
        uint32 _dataTimestamp,
        bytes32 _key,
        uint256 _value,
        uint8[] memory _v,
        bytes32[] memory _r,
        bytes32[] memory _s
    ) external {
        b+=1;

        address prevSigner = address(0x0);
        bytes32 hash = keccak256(abi.encodePacked(_dataTimestamp, _key, _value));

        for (uint256 i; i < _v.length;) {
            address signer = recoverSigner(hash, _v[i], _r[i], _s[i]);

            if (prevSigner >= signer) revert('SignaturesOutOfOrder()');

            prevSigner = signer;

            unchecked { i++; }
        }

//        fcdsT[_key].dataTimestamp = _dataTimestamp;
//        fcdsT[_key].value = _value;
//        fcds[_key] = _value;
    }

    function readOneFcd(
        bytes32 _key
    ) external returns(uint256 r) {
        b += 123;
//        console.log(gasleft());
//        r = fcds[_key];
//        console.log(gasleft());
    }
}
