// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "./Registry.sol";
import "./BaseChain.sol";

contract ForeignChain is BaseChain {
  // we will not be changing replicator that often, so we can make it immutable, it saves 200gas
  address public immutable replicator;
  uint32 public lastBlockId;

  // ========== EVENTS ========== //

  event LogBlockReplication(address indexed minter, uint32 blockId);

  // ========== CONSTRUCTOR ========== //

  constructor(
    address _contractRegistry,
    uint16 _padding,
    uint16 _requiredSignatures,
    address _replicator
  ) public BaseChain(_contractRegistry, _padding, _requiredSignatures) {
    replicator = _replicator;
  }

  modifier onlyReplicator() {
    require(msg.sender == replicator, "onlyReplicator");
    _;
  }

  // ========== MUTATIVE FUNCTIONS ========== //

  function submit(
    uint32 _dataTimestamp,
    bytes32 _root,
    bytes32[] calldata _keys,
    uint256[] calldata _values,
    uint32 _blockId
  ) external onlyReplicator {
    uint lastDataTimestamp = blocks[lastBlockId].extractTimestamp();

    require(blocks[_blockId].extractTimestamp() == 0, "blockId already taken");
    require(lastDataTimestamp < _dataTimestamp, "can NOT submit older data");
    require(lastDataTimestamp + padding < block.timestamp, "do not spam");
    require(_keys.length == _values.length, "numbers of keys and values not the same");

    for (uint256 i = 0; i < _keys.length; i++) {
      require(uint224(_values[i]) == _values[i], "FCD overflow");
      fcds[_keys[i]] = FirstClassData(uint224(_values[i]), _dataTimestamp);
    }

    blocks[_blockId] = MerkleProof.makeSquashedRoot(_root, _dataTimestamp);
    lastBlockId = _blockId;

    emit LogBlockReplication(msg.sender, _blockId);
  }

  // ========== VIEWS ========== //

  function isForeign() override external pure returns (bool) {
    return true;
  }

  function getName() override external pure returns (bytes32) {
    return "Chain";
  }

  function getStatus() external view returns(
    uint256 blockNumber,
    uint16 timePadding,
    uint32 lastDataTimestamp,
    uint32 lastId,
    uint32 nextBlockId
  ) {
    blockNumber = block.number;
    timePadding = padding;
    lastId = lastBlockId;
    lastDataTimestamp = blocks[lastId].extractTimestamp();
    nextBlockId = getBlockIdAtTimestamp(block.timestamp + 1);
  }

  // this function does not works for past timestamps
  function getBlockIdAtTimestamp(uint256 _timestamp) override public view  returns (uint32) {
    uint32 lastId = lastBlockId;
    uint32 dataTimestamp = blocks[lastId].extractTimestamp();

    if (dataTimestamp == 0) {
      return 0;
    }

    if (dataTimestamp + padding < _timestamp) {
      return lastId + 1;
    }

    return lastId;
  }

  function getLatestBlockId() override public view returns (uint32) {
    return lastBlockId;
  }
}
