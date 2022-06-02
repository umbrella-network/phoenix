// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
//pragma experimental ABIEncoderV2;

import "./Registry.sol";
import "./BaseChain.sol";

contract ForeignChain is BaseChain {
  using MerkleProof for bytes32;

  address public immutable replicator;
  uint32 public lastBlockId;
  bool public deprecated;

  event LogBlockReplication(address indexed minter, uint32 blockId);
  event LogDeprecation(address indexed deprecator);

  error OnlyReplicator();
  error OnlyContractRegistryCanRegister();
  error AlreadyRegistered();
  error AlreadyDeprecated();
  error UnregisterFirst();
  error InvalidContractType();
  error ContractDeprecated();
  error DuplicatedBlockId();

  constructor(
    IRegistry _contractRegistry,
    uint16 _padding,
    uint16 _requiredSignatures,
    address _replicator
  ) BaseChain(_contractRegistry, _padding, _requiredSignatures) {
    replicator = _replicator;
  }

  modifier onlyReplicator() {
    if (msg.sender != replicator) revert OnlyReplicator();
    _;
  }

  function register() override external {
    if (msg.sender != address(contractRegistry)) revert OnlyContractRegistryCanRegister();

    ForeignChain oldChain = ForeignChain(contractRegistry.getAddress("Chain"));
    // registration must be done before address in registry is replaced
    if (address(oldChain) == address(this)) revert AlreadyRegistered();

    if (address(oldChain) != address(0x0)) {
      lastBlockId = oldChain.lastBlockId();
      // we cloning last block time, because we will need reference point for next submissions

      // TODO remove this after first redeployment will be done
      //      we need two deployment to switch from blocks -> squashedRoots because previous version and this one
      //      are not compatible in a sense of registering/unregistering
      //      on release we will deploy contract with step1) then we can delete step1) completely
      //      later deployment can be done normally, using step2
      // step 1) first update
      uint32 lastBlockTime = oldChain.blocks(lastBlockId).dataTimestamp;
      bytes32 lastRootTime;

      // solhint-disable-next-line no-inline-assembly
      assembly {
        lastRootTime := or(0x0, lastBlockTime)
      }

      squashedRoots[lastBlockId] = lastRootTime;

      // step 2) next updates (we can remove step1)
      // squashedRoots[lastBlockId] = oldChain.squashedRoots(lastBlockId);
    }
  }

  function unregister() override external {
    if (msg.sender != address(contractRegistry)) revert OnlyContractRegistryCanRegister();
    if (deprecated) revert AlreadyDeprecated();

    ForeignChain newChain = ForeignChain(contractRegistry.getAddress("Chain"));
    // unregistering must be done after address in registry is replaced
    if (address(newChain) == address(this)) revert UnregisterFirst();
    // can not be replaced with chain of different type
    if (!newChain.isForeign()) revert InvalidContractType();

    deprecated = true;
    emit LogDeprecation(msg.sender);
  }

  function submit(
    uint32 _dataTimestamp,
    bytes32 _root,
    bytes32[] calldata _keys,
    uint256[] calldata _values,
    uint32 _blockId
  ) external onlyReplicator {
    if (deprecated) revert ContractDeprecated();

    uint lastDataTimestamp = squashedRoots[lastBlockId].extractTimestamp();

    if (squashedRoots[_blockId].extractTimestamp() != 0) revert DuplicatedBlockId();
    if (_dataTimestamp <= lastDataTimestamp) revert DataToOld();

    unchecked {
      // we will not overflow on `timestamp` and `padding` in a life time
      if (lastDataTimestamp + padding >= block.timestamp) revert BlockSubmittedToFast();
    }

    if (_keys.length != _values.length) revert ArraysDataDoNotMatch();

    for (uint256 i = 0; i < _keys.length;) {
      if (uint224(_values[i]) != _values[i]) revert FCDOverflow();

      fcds[_keys[i]] = FirstClassData(uint224(_values[i]), _dataTimestamp);

      unchecked {
        i++;
      }
    }

    squashedRoots[_blockId] = MerkleProof.makeSquashedRoot(_root, _dataTimestamp);
    lastBlockId = _blockId;

    emit LogBlockReplication(msg.sender, _blockId);
  }

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
    lastDataTimestamp = squashedRoots[lastId].extractTimestamp();

    unchecked {
      // we will not overflow on `timestamp` in a life time
      nextBlockId = getBlockIdAtTimestamp(block.timestamp + 1);
    }
  }

  // this function does not works for past timestamps
  function getBlockIdAtTimestamp(uint256 _timestamp) override public view  returns (uint32) {
    uint32 lastId = lastBlockId;
    uint32 dataTimestamp = squashedRoots[lastId].extractTimestamp();

    if (dataTimestamp == 0) {
      return 0;
    }

    unchecked {
      // we will not overflow on `timestamp` and `padding` in a life time
      if (dataTimestamp + padding < _timestamp) {
        return lastId + 1;
      }
    }

    return lastId;
  }

  function getLatestBlockId() override public view returns (uint32) {
    return lastBlockId;
  }
}
