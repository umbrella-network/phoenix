// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
//pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@umb-network/toolbox/dist/contracts/lib/ValueDecoder.sol";

import "./interfaces/IStakingBank.sol";
import "./extensions/Registrable.sol";
import "./Registry.sol";

import "./lib/MerkleProof.sol";

abstract contract BaseChain is Registrable, Ownable {
  using ValueDecoder for bytes;
  using ValueDecoder for uint224;
  using MerkleProof for bytes32;

  bytes constant public ETH_PREFIX = "\x19Ethereum Signed Message:\n32";

  struct Block {
    bytes32 root;
    uint32 dataTimestamp;
  }

  struct FirstClassData {
    uint224 value;
    uint32 dataTimestamp;
  }

  mapping(uint256 => bytes32) public squashedRoots;
  mapping(bytes32 => FirstClassData) public fcds;

  uint32 public blocksCount;
  uint32 public immutable blocksCountOffset;
  uint16 public padding;
  uint16 public immutable requiredSignatures;

  error NoChangeToState();
  error DataToOld();
  error BlockSubmittedToFast();
  error ArraysDataDoNotMatch();
  error FCDOverflow();

  constructor(
    IRegistry _contractRegistry,
    uint16 _padding,
    uint16 _requiredSignatures // we have a plan to use signatures also in foreign Chains so lets keep it in base
  ) Registrable(_contractRegistry) {
    _setPadding(_padding);
    requiredSignatures = _requiredSignatures;
    BaseChain oldChain = BaseChain(_contractRegistry.getAddress("Chain"));

    blocksCountOffset = address(oldChain) != address(0x0)
      // +1 because it might be situation when tx is already in progress in old contract
      ? oldChain.blocksCount() + oldChain.blocksCountOffset() + 1
      : 0;
  }

  function setPadding(uint16 _padding) external {
    _setPadding(_padding);
  }

  function isForeign() virtual external pure returns (bool);

  function recoverSigner(bytes32 _affidavit, uint8 _v, bytes32 _r, bytes32 _s) public pure returns (address) {
    bytes32 hash = keccak256(abi.encodePacked(ETH_PREFIX, _affidavit));
    return ecrecover(hash, _v, _r, _s);
  }

  function blocks(uint256 _blockId) external view returns (Block memory) {
    bytes32 root = squashedRoots[_blockId];
    return Block(root, root.extractTimestamp());
  }

  function getBlockId() public view returns (uint32) {
    return getBlockIdAtTimestamp(block.timestamp);
  }

  // this function does not works for past timestamps
  function getBlockIdAtTimestamp(uint256 _timestamp) virtual public view returns (uint32) {
    uint32 _blocksCount = blocksCount + blocksCountOffset;

    if (_blocksCount == 0) {
      return 0;
    }

    unchecked {
      // in theory we can overflow when we manually provide `_timestamp`
      // but for internal usage, we using block.timestamp, so we are safe when doing `+padding(uint16)`
      if (squashedRoots[_blocksCount - 1].extractTimestamp() + padding < _timestamp) {
        return _blocksCount;
      }

      // we can't underflow because of above `if (_blocksCount == 0)`
      return _blocksCount - 1;
    }
  }

  function getLatestBlockId() virtual public view returns (uint32) {
    unchecked {
      // we can underflow on very begin and this is OK, because next blockId will be +1 => that gives 0 (so first block)
      // overflow is not possible in a life time
      return blocksCount + blocksCountOffset - 1;
    }
  }

  function verifyProof(bytes32[] memory _proof, bytes32 _root, bytes32 _leaf) public pure returns (bool) {
    if (_root == bytes32(0)) {
      return false;
    }

    return _root.verify(_proof, _leaf);
  }

  function hashLeaf(bytes memory _key, bytes memory _value) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(_key, _value));
  }

  function verifyProofForBlock(
    uint256 _blockId,
    bytes32[] memory _proof,
    bytes memory _key,
    bytes memory _value
  ) public view returns (bool) {
    return squashedRoots[_blockId].verifySquashedRoot(_proof, keccak256(abi.encodePacked(_key, _value)));
  }

  function bytesToBytes32Array(
    bytes memory _data,
    uint256 _offset,
    uint256 _items
  ) public pure returns (bytes32[] memory) {
    bytes32[] memory dataList = new bytes32[](_items);

    // we can unchecked because we working only with `i` and `_offset`
    // in case of wrong `_offset` it will throw
    unchecked {
      for (uint256 i = 0; i < _items; i++) {
        bytes32 temp;
        uint256 idx = (i + 1 + _offset) * 32;

        // solhint-disable-next-line no-inline-assembly
        assembly {
          temp := mload(add(_data, idx))
        }

        dataList[i] = temp;
      }
    }

    return (dataList);
  }

  function verifyProofs(
    uint32[] memory _blockIds,
    bytes memory _proofs,
    uint256[] memory _proofItemsCounter,
    bytes32[] memory _leaves
  ) public view returns (bool[] memory results) {
    results = new bool[](_leaves.length);
    uint256 offset = 0;

    for (uint256 i = 0; i < _leaves.length;) {
      results[i] = squashedRoots[_blockIds[i]].verifySquashedRoot(
        bytesToBytes32Array(_proofs, offset, _proofItemsCounter[i]), _leaves[i]
      );

      unchecked {
        // we can uncheck because it will not overflow in a lifetime, and if someone provide invalid counter
        // we verification will not be valid (or we throw because of invalid memory access)
        offset += _proofItemsCounter[i];
        // we can uncheck because `i` will not overflow in a lifetime
        i++;
      }
    }
  }

  function getBlockRoot(uint32 _blockId) external view returns (bytes32) {
    return squashedRoots[_blockId].extractRoot();
  }

  function getBlockTimestamp(uint32 _blockId) external view returns (uint32) {
    return squashedRoots[_blockId].extractTimestamp();
  }

  function getCurrentValues(bytes32[] calldata _keys)
  external view returns (uint256[] memory values, uint32[] memory timestamps) {
    timestamps = new uint32[](_keys.length);
    values = new uint256[](_keys.length);

    for (uint i=0; i<_keys.length;) {
      FirstClassData storage numericFCD = fcds[_keys[i]];
      values[i] = uint256(numericFCD.value);
      timestamps[i] = numericFCD.dataTimestamp;

      unchecked {
        i++;
      }
    }
  }

  function getCurrentValue(bytes32 _key) external view returns (uint256 value, uint256 timestamp) {
    FirstClassData storage numericFCD = fcds[_key];
    return (uint256(numericFCD.value), numericFCD.dataTimestamp);
  }

  function getCurrentIntValue(bytes32 _key) external view returns (int256 value, uint256 timestamp) {
    FirstClassData storage numericFCD = fcds[_key];
    return (numericFCD.value.toInt(), numericFCD.dataTimestamp);
  }

  function _setPadding(uint16 _padding) internal onlyOwner {
    if (padding == _padding) revert NoChangeToState();

    padding = _padding;
    emit LogPadding(msg.sender, _padding);
  }

  event LogPadding(address indexed executor, uint16 timePadding);
}
