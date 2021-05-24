// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@umb-network/toolbox/dist/contracts/lib/ValueDecoder.sol";

import "./interfaces/IStakingBank.sol";
import "./interfaces/IValidatorRegistry.sol";

import "./extensions/Registrable.sol";
import "./Registry.sol";

contract Chain is Registrable, Ownable {
  using SafeMath for uint256;
  using ValueDecoder for bytes;

  // ========== STATE VARIABLES ========== //

  bytes constant public ETH_PREFIX = "\x19Ethereum Signed Message:\n32";

  struct Block {
    bytes32 root;
    uint32 dataTimestamp;
    uint128 affidavit;
  }

  struct FirstClassData {
    uint224 value;
    uint32 dataTimestamp;
  }

  mapping(uint256 => Block) public blocks;
  mapping(bytes32 => FirstClassData) public fcds;

  uint32 public blocksCount;
  uint32 public blocksCountOffset;
  uint16 public padding;

  // ========== CONSTRUCTOR ========== //

  constructor(address _contractRegistry, uint16 _padding) public Registrable(_contractRegistry) {
    padding = _padding;
    Chain oldChain = Chain(Registry(_contractRegistry).getAddress("Chain"));

    if (address(oldChain) != address(0x0)) {
      // +1 because it might be situation when tx is already in progress in old contract
      blocksCountOffset = oldChain.blocksCount() + oldChain.blocksCountOffset() + 1;
    }
  }

  // ========== MUTATIVE FUNCTIONS ========== //

  function setPadding(uint16 _padding) external onlyOwner {
    padding = _padding;
    emit LogPadding(msg.sender, _padding);
  }

  function submit(
    uint32 _dataTimestamp,
    bytes32 _root,
    bytes32[] memory _keys,
    uint256[] memory _values,
    uint8[] memory _v,
    bytes32[] memory _r,
    bytes32[] memory _s
  ) public {
    uint32 lastBlockId = getLatestBlockId();
    require(blocks[lastBlockId].dataTimestamp + padding < block.timestamp, "do not spam");
    require(blocks[lastBlockId].dataTimestamp < _dataTimestamp, "can NOT submit older data");
    require(_dataTimestamp <= block.timestamp, "oh, so you can predict future");
    require(_keys.length == _values.length, "numbers of keys and values not the same");

    bytes memory testimony = abi.encodePacked(_dataTimestamp, _root);

    for (uint256 i = 0; i < _keys.length; i++) {
      require(uint224(_values[i]) == _values[i], "FCD overflow");
      fcds[_keys[i]] = FirstClassData(uint224(_values[i]), _dataTimestamp);
      testimony = abi.encodePacked(testimony, _keys[i], _values[i]);
    }

    bytes32 affidavit = keccak256(testimony);
    uint256 power = 0;

    IStakingBank stakingBank = stakingBankContract();
    uint256 staked = stakingBank.totalSupply();
    address prevSigner = address(0x0);

    for (uint256 i = 0; i < _v.length; i++) {
      address signer = recoverSigner(affidavit, _v[i], _r[i], _s[i]);
      uint256 balance = stakingBank.balanceOf(signer);

      require(prevSigner < signer, "validator included more than once");
      prevSigner = signer;
      if (balance == 0) continue;

      emit LogVoter(lastBlockId + 1, signer, balance);
      power = power.add(balance);
    }

    // TODO to optimise, break the loop when get enough power
    require(power.mul(100) >= staked.mul(66), "not enough power was gathered");

    blocks[lastBlockId + 1].root = _root;
    blocks[lastBlockId + 1].dataTimestamp = _dataTimestamp;
    blocks[lastBlockId + 1].affidavit = uint128(bytes16(affidavit));
    blocksCount++;

    emit LogMint(msg.sender, lastBlockId + 1, staked, power);
  }

  // ========== VIEWS ========== //

  function getName() override external pure returns (bytes32) {
    return "Chain";
  }

  function recoverSigner(bytes32 _affidavit, uint8 _v, bytes32 _r, bytes32 _s) public pure returns (address) {
    bytes32 hash = keccak256(abi.encodePacked(ETH_PREFIX, _affidavit));
    return ecrecover(hash, _v, _r, _s);
  }

  function getStatus() external view returns(
    uint256 blockNumber,
    uint16 timePadding,
    uint32 lastDataTimestamp,
    uint32 lastBlockId,
    address nextLeader,
    uint32 nextBlockId,
    address[] memory validators,
    uint256[] memory powers,
    string[] memory locations,
    uint256 staked
  ) {
    blockNumber = block.number;
    timePadding = padding;
    lastBlockId = getLatestBlockId();
    lastDataTimestamp = blocks[lastBlockId].dataTimestamp;

    IValidatorRegistry vr = validatorRegistryContract();
    uint256 numberOfValidators = vr.getNumberOfValidators();
    validators = new address[](numberOfValidators);
    locations = new string[](numberOfValidators);

    for (uint256 i = 0; i < numberOfValidators; i++) {
      validators[i] = vr.addresses(i);
      (, locations[i]) = vr.validators(validators[i]);
    }

    nextLeader = numberOfValidators > 0
      ? validators[getLeaderIndex(numberOfValidators, block.timestamp + 1)]
      : address(0);

    IStakingBank stakingBank = stakingBankContract();
    powers = new uint256[](numberOfValidators);
    staked = stakingBank.totalSupply();

    for (uint256 i = 0; i < numberOfValidators; i++) {
      powers[i] = stakingBank.balanceOf(validators[i]);
    }

    nextBlockId = getBlockId();
  }

  function getBlockId() public view returns (uint32) {
    uint32 _blocksCount = blocksCount + blocksCountOffset;

    if (_blocksCount == 0) {
      return 0;
    }

    if (blocks[_blocksCount - 1].dataTimestamp + padding < block.timestamp) {
      return _blocksCount;
    }

    return _blocksCount - 1;
  }

  function getLatestBlockId() public view returns (uint32) {
    return blocksCount + blocksCountOffset - 1;
  }

  // note: I think its time to move leader selection from Chain
  // we don't have anchor so we using timestamp, but timestamp if available without calling blockchain
  // I will leave this methods but it should be deprecated soon
  function getLeaderIndex(uint256 _numberOfValidators, uint256 _timestamp) public view returns (uint256) {
    uint32 latestBlockId = getLatestBlockId();

    // timePadding + 1 => because padding is a space between blocks, so next round starts on first block after padding
    uint256 validatorIndex = latestBlockId +
      (_timestamp - blocks[latestBlockId].dataTimestamp) / (padding + 1);

    return uint16(validatorIndex % _numberOfValidators);
  }

  function getNextLeaderAddress() public view returns (address) {
    return getLeaderAddressAtTime(block.timestamp + 1);
  }

  function getLeaderAddress() public view returns (address) {
    return getLeaderAddressAtTime(block.timestamp);
  }

  // @todo - properly handled non-enabled validators, newly added validators, and validators with low stake
  function getLeaderAddressAtTime(uint256 _timestamp) public view returns (address) {
    IValidatorRegistry validatorRegistry = validatorRegistryContract();

    uint256 numberOfValidators = validatorRegistry.getNumberOfValidators();

    if (numberOfValidators == 0) {
      return address(0x0);
    }

    uint256 validatorIndex = getLeaderIndex(numberOfValidators, _timestamp);

    return validatorRegistry.addresses(validatorIndex);
  }

  function verifyProof(bytes32[] memory _proof, bytes32 _root, bytes32 _leaf) public view returns (bool) {
    if (_root == bytes32(0)) {
      return false;
    }

    return MerkleProof.verify(_proof, _root, _leaf);
  }

  function hashLeaf(bytes memory _key, bytes memory _value) public view returns (bytes32) {
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
  event LogMint(address indexed minter, uint256 blockId, uint256 staked, uint256 power);
  event LogVoter(uint256 indexed blockId, address indexed voter, uint256 vote);
}
