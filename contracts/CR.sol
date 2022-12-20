// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "hardhat/console.sol";
import "./CRbank.sol";

// contract for estimating Custom solution for deri finance
contract CR {
    uint256 constant public TIMESTAMP_MASK = 2 ** 64 - 1; // 0xffffffffffffffff;

    uint256 b;

    struct FirstClassData {
        uint224 value;
        uint32 dataTimestamp;
    }

    struct FirstClassDataSquashed {
        uint64 value1; // 32: 429_496.7296n
        uint64 value2;
        uint64 value3;
        uint64 dataTimestamp;
    }

    FirstClassDataSquashed public fcdsS;
    mapping(bytes32 => FirstClassDataSquashed) public fcdsMap;
    mapping(bytes32 => FirstClassData) public fcdsT;
    mapping(bytes32 => uint256) public fcds;

    bytes constant public ETH_PREFIX = "\x19Ethereum Signed Message:\n32";
    uint256 constant public FCDSS_SLOT = 1;

    address public immutable v1;
    address public immutable v2;
    address public immutable v3;
    address public immutable v4;
    address public immutable v5;
    address public immutable v6;
    address public immutable v7;
    address public immutable v8;
    address public immutable v9;
    address public immutable v10;

    CRbank immutable public BANK;

    constructor(CRbank _bank, address[] memory _validators) {
        b=1;
        fcds[bytes32(0x4500000000000000000000000000000000000000000000000000000000000000)] = 123_987;

//        uint256 _fcdsS = uint256(TIMESTAMP_MASK & block.timestamp);

//        assembly {
//            sstore(FCDSS_SLOT, _fcdsS)
//        }
        fcdsS.dataTimestamp = uint64(block.timestamp);

        BANK = _bank;

        uint256 i;
        v1 = _validators[i];
        v2 = ++i >= _validators.length ? address(0) : _validators[i];
        v3 = ++i >= _validators.length ? address(0) : _validators[i];
        v4 = ++i >= _validators.length ? address(0) : _validators[i];
        v5 = ++i >= _validators.length ? address(0) : _validators[i];
        v6 = ++i >= _validators.length ? address(0) : _validators[i];
        v7 = ++i >= _validators.length ? address(0) : _validators[i];
        v8 = ++i >= _validators.length ? address(0) : _validators[i];
        v9 = ++i >= _validators.length ? address(0) : _validators[i];
        v10 = ++i >= _validators.length ? address(0) : _validators[i];
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

        bytes32 hash = keccak256(abi.encodePacked(_dataTimestamp, _key, _value));

        verifySignatures(hash, _v, _r, _s);

        //        fcdsT[_key].dataTimestamp = _dataTimestamp;
//        fcdsT[_key].value = _value;
//        fcds[_key] = _value;
    }

    function verifySignatures(
        bytes32 hash,
        uint8[] memory _v,
        bytes32[] memory _r,
        bytes32[] memory _s
    ) internal {
        address prevSigner = address(0x0);

        for (uint256 i; i < _v.length;) {
            address signer = recoverSigner(hash, _v[i], _r[i], _s[i]);

            if (!BANK.balanceOf(signer)) revert('not a signer');
            if (prevSigner >= signer) revert('SignaturesOutOfOrder()');

            prevSigner = signer;

            unchecked { i++; }
        }
    }

    function verifyImmutableSignatures(
        bytes32 hash,
        uint8[] memory _v,
        bytes32[] memory _r,
        bytes32[] memory _s
    ) internal {
        address prevSigner = address(0x0);

        for (uint256 i; i < _v.length;) {
            address signer = recoverSigner(hash, _v[i], _r[i], _s[i]);

            if (v1 == signer) {
                // ok
            } else if (v2 == signer) {
                // ok
            } else if (v3 == signer) {
                // ok
            } else if (v4 == signer) {
                // ok
            } else if (v5 == signer) {
                // ok
            }  else if (v6 == signer) {
                // ok
            }  else if (v7 == signer) {
                // ok
            }  else if (v8 == signer) {
                // ok
            }  else if (v9 == signer) {
                // ok
            }  else if (v10 == signer) {
                // ok
            } else {
                revert('not a signer!!!');
            }

            if (prevSigner >= signer) revert('SignaturesOutOfOrder()');

            prevSigner = signer;

            unchecked { i++; }
        }
    }

//    function verifySignatures2(
//        bytes32 hash,
//        uint8[] memory _v,
//        bytes32[] memory _r,
//        bytes32[] memory _s
//    ) internal {
//        address prevSigner = address(0x0);
//        address[] memory allValidators = BANK.allValidators();
////        uint256 vId = 0;
//        uint256 vCount = allValidators.length;
//
//        for (uint256 i; i < _v.length;) {
//            address signer = recoverSigner(hash, _v[i], _r[i], _s[i]);
//
//            bool ok = false;
//            uint v;
//            while (v < vCount) {
//                if (allValidators[v] == signer) {
//                    ok = true;
//                    break;
//                }
//
//                v++;
//            }
////            if (BANK.balanceOf(signer) == 0) revert('not a signer');
//            if (!ok) revert('!ok');
//            if (prevSigner >= signer) revert('SignaturesOutOfOrder()');
//
//            prevSigner = signer;
//
//            unchecked { i++; }
//        }
//    }

    // with 5 signatures, subtract 21K for base fee!
    // -------:             Min        ·  Max         ·  Avg        ·  # calls
    // save #1:             60223  ·      77359  ·      63667  ·           10
    // save random keys:    60223  ·      77383  ·      63708  ·           10
    // ~6500gas per sign verification
    function submitOneSquashedFcd(
        uint32 _dataTimestamp,
        bytes32 _id,
        uint64 _value,
        uint8[] calldata _v,
        bytes32[] calldata _r,
        bytes32[] calldata _s
    ) external {
        bytes32 hash = keccak256(abi.encodePacked(_dataTimestamp, _id, uint256(_value)));

        verifySignatures(hash, _v, _r, _s);

        uint256 offset = uint256(_id);

        fcdsS.dataTimestamp = _dataTimestamp;

        if (offset == 1) {
            fcdsS.value1 = _value;
        } else if (offset == 2) {
            fcdsS.value2 = _value;
        } else if (offset == 3) {
            fcdsS.value3 = _value;
        } else {
            revert();
        }

//        fcdsS = fcdsS && (_dataTimestamp || (SPOT_MASK >> offset));

        //        fcdsT[_key].dataTimestamp = _dataTimestamp;
//        fcdsT[_key].value = _value;
//        fcds[_key] = _value;
    }


    function exctractTime(bytes32 _fcdsS) public pure returns (uint64) {
        return uint64(TIMESTAMP_MASK & uint256(_fcdsS));
    }

    function extractValue(uint256 _index, bytes32 _fcdsS) public pure returns (uint64) {
        return uint64(TIMESTAMP_MASK & (uint256(_fcdsS) >> _index));
    }


    // with 5 signatures, subtract 21K for base fee!
    // -------:             Min        ·  Max         ·  Avg        ·  # calls
    // save #1:             58752  ·      75876  ·      62201  ·           10
    // with time check:     58922  ·      76034  ·      62354  ·           10
    // after initialization save + check: 58886 constant
    // when we call for balance each time: 79102

    // with uint64 3 prices + timestamp costs is the same
    // if we use immutable validators, we can reduce by 20K (25%)

    function submitAllSquashedFcd(
        bytes32 _fcdsS,
        uint8[] calldata _v,
        bytes32[] calldata _r,
        bytes32[] calldata _s
    ) external {
        // this will use ~180gas
        // we will initialized with current timestamp
        if (uint256(TIMESTAMP_MASK & uint256(_fcdsS)) < fcdsS.dataTimestamp) revert("too old");

        verifySignatures(_fcdsS, _v, _r, _s);

        assembly {
            sstore(FCDSS_SLOT, _fcdsS)
        }

//        fcdsS = _fcdsS;
//        fcdsS = fcdsS && (_dataTimestamp || (SPOT_MASK >> offset));

        //        fcdsT[_key].dataTimestamp = _dataTimestamp;
//        fcdsT[_key].value = _value;
//        fcds[_key] = _value;
    }


    function submitAllSquashedFcdMap(
        bytes32 _key,
        bytes32 _fcdsS,
        uint8[] calldata _v,
        bytes32[] calldata _r,
        bytes32[] calldata _s
    ) external {
        // this will use ~180gas
        // we will initialized with current timestamp
        if (uint256(TIMESTAMP_MASK & uint256(_fcdsS)) < fcdsS.dataTimestamp) revert("too old");
        if (_key != bytes32(uint256(0xabc))) revert("invalid key");

        bytes32 k = keccak256(abi.encodePacked(_key, uint256(_fcdsS)));

        verifyImmutableSignatures(k, _v, _r, _s); // 34536 just store, 60K store + immutable verification
//        verifySignatures(k, _v, _r, _s); // 34536 just store, 80K store + memory verification

        // 72600
        uint t = exctractTime(_fcdsS);
        uint v = extractValue(1, _fcdsS); // 69720
        uint v2 = extractValue(3, _fcdsS);

//    (uint v, uint t) = BANK.value1();
//    (uint v, uint v2, uint t) = BANK.bothValues();

        assembly {
            sstore(FCDSS_SLOT, _fcdsS)
        }
//        assembly {
//            mstore(0, _key)
//            mstore(32, fcdsMap.slot)
//            let hash := keccak256(0, 64)
//            sstore(hash, _fcdsS)
//        }
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
