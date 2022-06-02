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

  /// @param root merkle root for consensus
  /// @param dataTimestamp consensus timestamp
  struct Block {
    bytes32 root;
    uint32 dataTimestamp;
  }

  /// @param value FCD value
  /// @param dataTimestamp FCD timestamp
  struct FirstClassData {
    uint224 value;
    uint32 dataTimestamp;
  }

  bytes constant public ETH_PREFIX = "\x19Ethereum Signed Message:\n32";

  /// @dev block id (consensus ID) => root (squashedRoot)
  /// squashedRoots is composed as: 28 bytes of original root + 4 bytes for timestamp
  mapping(uint256 => bytes32) public squashedRoots;

  /// @dev FCD key => FCD data
  mapping(bytes32 => FirstClassData) public fcds;

  /// @dev number of blocks (consensus rounds) saved in this contract
  uint32 public blocksCount;

  /// @dev number of all blocks that were generated before switching to this contract
  /// please note, that there might be a gap of one block when we switching from old to new contract
  /// see constructor for details
  uint32 public immutable blocksCountOffset;

  /// @dev number of seconds that need to pass before new submit will be possible
  uint16 public padding;

  /// @dev minimal number of signatures required for accepting submission (PoA)
  uint16 public immutable requiredSignatures;

  error NoChangeToState();
  error DataToOld();
  error BlockSubmittedToFast();
  error ArraysDataDoNotMatch();
  error FCDOverflow();

  /// @param _contractRegistry Registry address
  /// @param _padding required "space" between blocks in seconds
  /// @param _requiredSignatures number of required signatures for accepting consensus submission
  /// we have a plan to use signatures also in foreign Chains so lets keep it in BaseChain
  constructor(
    IRegistry _contractRegistry,
    uint16 _padding,
    uint16 _requiredSignatures
  ) Registrable(_contractRegistry) {
    _setPadding(_padding);
    requiredSignatures = _requiredSignatures;
    BaseChain oldChain = BaseChain(_contractRegistry.getAddress("Chain"));

    blocksCountOffset = address(oldChain) != address(0x0)
      // +1 because it might be situation when tx is already in progress in old contract
      ? oldChain.blocksCount() + oldChain.blocksCountOffset() + 1
      : 0;
  }

  /// @dev setter for `padding`
  function setPadding(uint16 _padding) external {
    _setPadding(_padding);
  }

  /// @return TRUE if contract is ForeignChain, FALSE otherwise
  function isForeign() virtual external pure returns (bool);

  /// @param _affidavit root and FCDs hashed together
  /// @param _v part of signature
  /// @param _r part of signature
  /// @param _s part of signature
  /// @return signer address
  function recoverSigner(bytes32 _affidavit, uint8 _v, bytes32 _r, bytes32 _s) public pure returns (address) {
    bytes32 hash = keccak256(abi.encodePacked(ETH_PREFIX, _affidavit));
    return ecrecover(hash, _v, _r, _s);
  }

  /// @param _blockId ID of submitted block
  /// @return block data (root + timestamp)
  function blocks(uint256 _blockId) external view returns (Block memory) {
    bytes32 root = squashedRoots[_blockId];
    return Block(root, root.extractTimestamp());
  }

  /// @return current block ID, please not this is different from last block ID, current means that once padding pass
  /// block ID will switch to next one and it will be pointing to empty submit, until submit for that block is done
  function getBlockId() public view returns (uint32) {
    return getBlockIdAtTimestamp(block.timestamp);
  }

  /// @dev calculates block ID for provided timestamp
  /// this function does not works for past timestamps
  /// @param _timestamp current or future timestamp
  /// @return block ID for provided timestamp
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

  /// @return last submitted block ID, please note, that on deployment, when there is no submission for this contract
  /// block for last ID will be available in previous contract
  function getLatestBlockId() virtual public view returns (uint32) {
    unchecked {
      // we can underflow on very begin and this is OK, because next blockId will be +1 => that gives 0 (so first block)
      // overflow is not possible in a life time
      return blocksCount + blocksCountOffset - 1;
    }
  }

  /// @dev verifies if the leaf is valid leaf for merkle tree
  /// @param _proof merkle proof for merkle tree
  /// @param _root merkle root
  /// @param _leaf leaf hash
  /// @return TRUE if `_leaf` is valid, FALSE otherwise
  function verifyProof(bytes32[] memory _proof, bytes32 _root, bytes32 _leaf) public pure returns (bool) {
    if (_root == bytes32(0)) {
      return false;
    }

    return _root.verify(_proof, _leaf);
  }

  /// @dev creates leaf hash, that has is used in merkle tree
  /// @param _key key under which we store the value
  /// @param _value value itself as bytes
  /// @return leaf hash
  function hashLeaf(bytes memory _key, bytes memory _value) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(_key, _value));
  }

  /// @dev verifies, if provided key-value pair was part of consensus
  /// @param _blockId consensus ID for which we doing a check
  /// @param _proof merkle proof for pair
  /// @param _key pair key
  /// @param _value pair value
  /// @return TRUE if key-value par was part of consensus, FALSE otherwise
  function verifyProofForBlock(
    uint256 _blockId,
    bytes32[] memory _proof,
    bytes memory _key,
    bytes memory _value
  ) public view returns (bool) {
    return squashedRoots[_blockId].verifySquashedRoot(_proof, keccak256(abi.encodePacked(_key, _value)));
  }

  /// @dev this is helper method, that extracts one merkle proof from many hashed provided as bytes
  /// @param _data many hashes as bytes
  /// @param _offset this is starting point for extraction
  /// @param _items how many hashes to extract
  /// @return merkle proof (array of bytes32 hashes)
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

  /// @dev batch method for data verification
  /// @param _blockIds consensus IDs for which we doing a checks
  /// @param _proofs merkle proofs for all pair, sequence of hashes provided as bytes
  /// @param _proofItemsCounter array of counters, each counter tells how many hashes proof for each leaf has
  /// @param _leaves array of merkle leaves
  /// @return results array of verification results, TRUE if leaf is part of consensus, FALSE otherwise
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

  /// @param _blockId consensus ID
  /// @return root for provided consensus ID
  function getBlockRoot(uint32 _blockId) external view returns (bytes32) {
    return squashedRoots[_blockId].extractRoot();
  }

  /// @param _blockId consensus ID
  /// @return timestamp for provided consensus ID
  function getBlockTimestamp(uint32 _blockId) external view returns (uint32) {
    return squashedRoots[_blockId].extractTimestamp();
  }

  /// @dev batch getter for FCDs
  /// @param _keys FCDs keys to fetch
  /// @return values array of FCDs values
  /// @return timestamps array of FCDs timestamps
  function getCurrentValues(bytes32[] calldata _keys)
  external view returns (uint256[] memory values, uint32[] memory timestamps) {
    timestamps = new uint32[](_keys.length);
    values = new uint256[](_keys.length);

    for (uint i=0; i<_keys.length;) {
      FirstClassData storage numericFCD = fcds[_keys[i]];
      values[i] = uint256(numericFCD.value);
      timestamps[i] = numericFCD.dataTimestamp;

      unchecked {
        // we can uncheck because `i` will not overflow in a lifetime
        i++;
      }
    }
  }

  /// @dev getter for single FCD value
  /// @param _key FCD key
  /// @return value FCD value
  /// @return timestamp FCD timestamp
  function getCurrentValue(bytes32 _key) external view returns (uint256 value, uint256 timestamp) {
    FirstClassData storage numericFCD = fcds[_key];
    return (uint256(numericFCD.value), numericFCD.dataTimestamp);
  }

  /// @dev getter for single FCD value in case its type is `int`
  /// @param _key FCD key
  /// @return value FCD value
  /// @return timestamp FCD timestamp
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
