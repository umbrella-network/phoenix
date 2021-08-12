// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@umb-network/toolbox/dist/contracts/lib/ValueDecoder.sol";

import "./extensions/Registrable.sol";
import "./Registry.sol";

contract BridgedChain is Registrable, Ownable {
  using ValueDecoder for bytes;

  // ========== STATE VARIABLES ========== //

  bytes constant public ETH_PREFIX = "\x19Ethereum Signed Message:\n32";

  struct Block {
    bytes32 root;
    uint32 dataTimestamp;
  }

  struct FirstClassData {
    uint224 value;
    uint32 dataTimestamp;
  }

  mapping(uint256 => Block) public blocks;
  mapping(bytes32 => FirstClassData) public fcds;

  uint256 public blockId;

  IERC721 public relayToken;

  // ========== CONSTRUCTOR ========== //

  constructor(
    address _contractRegistry
  ) public Registrable(_contractRegistry) {
    relayToken = IERC721(Registry(_contractRegistry).getAddress("RelayToken"));
  }

  // ========== MUTATIVE FUNCTIONS ========== //

  function setPadding(uint16 _padding) external onlyOwner {
    emit LogPadding(msg.sender, _padding);
  }

  function submit(
    uint32 _blockId,
    uint32 _dataTimestamp,
    bytes32 _root,
    bytes32[] memory _keys,
    uint256[] memory _values
  ) public {
    require(blockId < _blockId, "Should only submit a newer block");

    // we can't expect minter will have exactly the same timestamp
    // but for sure we can demand not to be off by a lot, that's why +3sec
    // temporary remove this condition, because recently on ropsten we see cases when minter/node
    // can be even 100sec behind
    // require(_dataTimestamp <= block.timestamp + 3,
    //   string(abi.encodePacked("oh, so you can predict the future:", _dataTimestamp - block.timestamp + 48)));
    require(_keys.length == _values.length, "numbers of keys and values not the same");

    bytes memory testimony = abi.encodePacked(_dataTimestamp, _root);

    for (uint256 i = 0; i < _keys.length; i++) {
      require(uint224(_values[i]) == _values[i], "FCD overflow");
      fcds[_keys[i]] = FirstClassData(uint224(_values[i]), _dataTimestamp);
      testimony = abi.encodePacked(testimony, _keys[i], _values[i]);
    }

    bytes32 affidavit = keccak256(abi.encodePacked(testimony, _blockId));

    uint32 tokenId;
    assembly {
      tokenId := mload(add(affidavit, 32))
    }

    require(relayToken.ownerOf(tokenId) != address(0x0), "A relay token should exist");

    blocks[_blockId] = Block(_root, _dataTimestamp);
    blockId = _blockId;

    emit LogMint(msg.sender, _blockId);
  }

  // ========== VIEWS ========== //

  function getName() override external pure returns (bytes32) {
    return "Chain";
  }

  function recoverSigner(bytes32 _affidavit, uint8 _v, bytes32 _r, bytes32 _s) public pure returns (address) {
    bytes32 hash = keccak256(abi.encodePacked(ETH_PREFIX, _affidavit));
    return ecrecover(hash, _v, _r, _s);
  }

  function getBlockId() public view returns (uint256) {
    return blockId;
  }

  function verifyProof(bytes32[] memory _proof, bytes32 _root, bytes32 _leaf) public pure returns (bool) {
    if (_root == bytes32(0)) {
      return false;
    }

    return MerkleProof.verify(_proof, _root, _leaf);
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
    return verifyProof(_proof, blocks[_blockId].root, keccak256(abi.encodePacked(_key, _value)));
  }

  function bytesToBytes32Array(
    bytes memory _data,
    uint256 _offset,
    uint256 _items
  ) public pure returns (bytes32[] memory) {
    bytes32[] memory dataList = new bytes32[](_items);

    for (uint256 i = 0; i < _items; i++) {
      bytes32 temp;
      uint256 idx = (i + 1 + _offset) * 32;

      assembly {
        temp := mload(add(_data, idx))
      }

      dataList[i] = temp;
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

    for (uint256 i = 0; i < _leaves.length; i++) {
      results[i] = verifyProof(
        bytesToBytes32Array(_proofs, offset, _proofItemsCounter[i]),
        blocks[_blockIds[i]].root,
        _leaves[i]
      );

      offset += _proofItemsCounter[i];
    }
  }

  function getBlockRoot(uint32 _blockId) external view returns (bytes32) {
    return blocks[_blockId].root;
  }

  function getBlockTimestamp(uint32 _blockId) external view returns (uint32) {
    return blocks[_blockId].dataTimestamp;
  }

  function getCurrentValues(bytes32[] calldata _keys)
  external view returns (uint256[] memory values, uint32[] memory timestamps) {
    timestamps = new uint32[](_keys.length);
    values = new uint256[](_keys.length);

    for (uint i=0; i<_keys.length; i++) {
      FirstClassData storage numericFCD = fcds[_keys[i]];
      values[i] = uint256(numericFCD.value);
      timestamps[i] = numericFCD.dataTimestamp;
    }
  }

  function getCurrentValue(bytes32 _key) external view returns (uint256 value, uint256 timestamp) {
    FirstClassData storage numericFCD = fcds[_key];
    return (uint256(numericFCD.value), numericFCD.dataTimestamp);
  }

  // ========== EVENTS ========== //

  event LogPadding(address indexed executor, uint16 timePadding);
  event LogMint(address indexed minter, uint256 blockId);
}
