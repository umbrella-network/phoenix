// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./lib/LeafDecoder.sol";
import "./interfaces/IStakingBank.sol";
import "./interfaces/IValidatorRegistry.sol";

import "./extensions/Registrable.sol";
import "./Registry.sol";

contract Chain is ReentrancyGuard, Registrable, Ownable {
  using SafeMath for uint256;
  using LeafDecoder for bytes;

  // ========== STATE VARIABLES ========== //

  uint256 public blockPadding;

  bytes constant public ETH_PREFIX = "\x19Ethereum Signed Message:\n32";

  struct Block {
    bytes32 root;
    address minter;
    uint256 staked;
    uint256 power;
    uint256 anchor;
    uint256 timestamp;
    uint256 dataTimestamp;
    // instead of Chain provides blockHeight for validators to calculate
    // each validator can calculate blockHeight by itself easily
    // however, validator can do it slighty different:
    // Chain keep blockHeight at same level even if there is no vote for "round", because this allow to not
    // have empty blocks, but validator can actually increment blockHeight each round and use it as nonce
    // that way if we have two tx (slow/old, and new one made for next round), they will use different nonce
    // and we can accept both, currenty for that situation we get thrwo with error: blockHeight already taken
    uint256 nonce;
  }

  struct ExtendedBlock {
    Block data;
    address[] voters;
    mapping(address => uint256) votes;
    mapping(bytes32 => uint256) numericFCD;
  }

  mapping(uint256 => ExtendedBlock) public blocks;

  uint256 public blocksCount;
  uint256 public blocksCountOffset;

  // ========== CONSTRUCTOR ========== //

  constructor(address _contractRegistry, uint256 _blockPadding) public Registrable(_contractRegistry) {
    blockPadding = _blockPadding;

    Chain oldChain = Chain(Registry(_contractRegistry).getAddress("Chain"));

    if (address(oldChain) != address(0x0)) {
      // +1 because it might be situation when tx is already in progress in old contract
      blocksCountOffset = oldChain.blocksCount() + oldChain.blocksCountOffset() + 1;
    }
  }

  // ========== MUTATIVE FUNCTIONS ========== //

  function setBlockPadding(uint256 _blockPadding) external onlyOwner {
    blockPadding = _blockPadding;
    emit LogBlockPadding(msg.sender, _blockPadding);
  }

  function submit(
    // nonce will help to see for which round validator is voting, help with debug,
    // allows for slow tx to be accepted since we no longer checking leader
    uint256 _nonce,
    uint256 _dataTimestamp,
    bytes32 _root,
    bytes32[] memory _keys,
    uint256[] memory _values,
    uint8[] memory _v,
    bytes32[] memory _r,
    bytes32[] memory _s
  ) public nonReentrant returns (bool) {
    uint256 latestBlockId = getLatestBlockId();
    uint256 newBlockId = latestBlockId + 1;

    // in future we can add timePadding and remove blockPadding
    require(blocks[latestBlockId].data.dataTimestamp < _dataTimestamp, "can NOT submit older data");
    require(blocks[latestBlockId].data.nonce < _nonce, "nonce already taken");

    bytes memory testimony = abi.encodePacked(_nonce, _dataTimestamp, _root);

    require(_keys.length == _values.length, "numbers of keys and values not the same");

    for (uint256 i = 0; i < _keys.length; i++) {
      blocks[newBlockId].numericFCD[_keys[i]] = _values[i];
      testimony = abi.encodePacked(testimony, _keys[i], _values[i]);
    }

    IStakingBank stakingBank = stakingBankContract();
    uint256 staked = stakingBank.totalSupply();
    bytes32 affidavit = keccak256(testimony);

    blocks[newBlockId].data.nonce = _nonce;
    blocks[newBlockId].data.root = _root;
    blocks[newBlockId].data.minter = msg.sender;
    blocks[newBlockId].data.staked = staked;
    blocks[newBlockId].data.power = _validateSignatures(stakingBank, newBlockId, affidavit, _v, _r, _s, staked);
    blocks[newBlockId].data.anchor = block.number;
    blocks[newBlockId].data.timestamp = block.timestamp;
    blocks[newBlockId].data.dataTimestamp = _dataTimestamp;

    blocksCount++;

    emit LogMint(msg.sender, newBlockId, block.number);

    return true;
  }

  function _validateSignatures(
    IStakingBank _stakingBank,
    uint256 _newBlockId,
    bytes32 _affidavit,
    uint8[] memory _v,
    bytes32[] memory _r,
    bytes32[] memory _s,
    uint256 _staked
  ) internal returns (uint256 power){
    power = 0;

    for (uint256 i = 0; i < _v.length; i++) {
      address signer = recoverSigner(_affidavit, _v[i], _r[i], _s[i]);
      uint256 balance = _stakingBank.balanceOf(signer);
      require(blocks[_newBlockId].votes[signer] == 0, "validator included more than once");

      if (balance == 0) {
        // if no balance -> move on, it can be invalid address but also fresh validator with no balance
        // we can spend gas and check if address is validator address, but I see no point, its cheaper to ignore
        // if we calculated root for other blockHeight, then recovering signer will not work -> move on
        continue;
      }

      blocks[_newBlockId].voters.push(signer);
      blocks[_newBlockId].votes[signer] = balance;
      power = power.add(balance);
    }

    require(power.mul(100) > _staked.mul(66), "not enough power was gathered");
  }

  // ========== VIEWS ========== //

  function getName() override external pure returns (bytes32) {
    return "Chain";
  }

  function recoverSigner(bytes32 affidavit, uint8 _v, bytes32 _r, bytes32 _s) public pure returns (address) {
    bytes32 hash = keccak256(abi.encodePacked(ETH_PREFIX, affidavit));
    return ecrecover(hash, _v, _r, _s);
  }

  // we should calculate this in validator, Im only showing how to do it
  // validator should use getStatus and he will have all he needs
  function getNextNonce() public view returns (uint256) {
    uint256 lastBlockId = getLatestBlockId();
    return blocks[lastBlockId].data.nonce + (block.number - blocks[lastBlockId].data.anchor) / blockPadding;
  }

  function getStatus() external view returns(
    address nextLeader,
    address[] memory validators,
    uint256[] memory powers,
    string[] memory locations,
    uint256 staked,
    uint256 lastBlockId,
    uint256 lastNonce,
    uint256 nextNonce
  ) {
    nextLeader = getLeaderAddressAtBlock(block.number);
    lastBlockId = getLatestBlockId();
    lastNonce = blocks[lastBlockId].data.nonce;
    nextNonce = getNextNonce();

    IValidatorRegistry vr = validatorRegistryContract();
    uint256 numberOfValidators = vr.getNumberOfValidators();
    validators = new address[](numberOfValidators);
    locations = new string[](numberOfValidators);

    for (uint256 i = 0; i < validators.length; i++) {
      validators[i] = vr.addresses(i);
      ( , locations[i]) = vr.validators(validators[i]);
    }

    IStakingBank stakingBank = stakingBankContract();
    powers = new uint256[](validators.length);
    staked = stakingBank.totalSupply();

    for (uint256 i = 0; i < validators.length; i++) {
      powers[i] = stakingBank.balanceOf(validators[i]);
    }
  }

  function getLatestBlockId() public view returns (uint256) {
    return blocksCount + blocksCountOffset - 1;
  }

  function getLeaderIndex(uint256 numberOfValidators, uint256 ethBlockNumber) public view returns (uint256) {
    uint256 latestBlockId = getLatestBlockId();

    uint256 validatorIndex = latestBlockId +
      (ethBlockNumber - blocks[latestBlockId].data.anchor) / blockPadding;

    return validatorIndex % numberOfValidators;
  }

  function getNextLeaderAddress() public view returns (address) {
    return getLeaderAddressAtBlock(block.number + 1);
  }

  function getLeaderAddress() public view returns (address) {
    return getLeaderAddressAtBlock(block.number);
  }

  // @todo - properly handled non-enabled validators, newly added validators, and validators with low stake
  function getLeaderAddressAtBlock(uint256 ethBlockNumber) public view returns (address) {
    IValidatorRegistry validatorRegistry = validatorRegistryContract();

    uint256 numberOfValidators = validatorRegistry.getNumberOfValidators();

    if (numberOfValidators == 0) {
      return address(0x0);
    }

    uint256 validatorIndex = getLeaderIndex(numberOfValidators, ethBlockNumber);

    return validatorRegistry.addresses(validatorIndex);
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
    return verifyProof(_proof, blocks[_blockId].data.root, hashLeaf(_key, _value));
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
    uint256[] memory _blockIds,
    bytes memory _proofs,
    uint256[] memory _proofItemsCounter,
    bytes32[] memory _leaves
  ) public view returns (bool[] memory results) {
    results = new bool[](_leaves.length);
    uint256 offset = 0;

    for (uint256 i = 0; i < _leaves.length; i++) {
      results[i] = verifyProof(
        bytesToBytes32Array(_proofs, offset, _proofItemsCounter[i]),
        blocks[_blockIds[i]].data.root,
        _leaves[i]
      );

      offset += _proofItemsCounter[i];
    }
  }

  function decodeLeafToNumber(bytes memory _leaf) public pure returns (uint) {
    return _leaf.leafToUint();
  }

  function decodeLeafToFloat(bytes memory _leaf) public pure returns (uint) {
    return _leaf.leafTo18DecimalsFloat();
  }

  function verifyProofForBlockForNumber(
    uint256 _blockId,
    bytes32[] memory _proof,
    bytes memory _key,
    bytes memory _value
  ) public view returns (bool, uint256) {
    return (verifyProof(_proof, blocks[_blockId].data.root, hashLeaf(_key, _value)), _value.leafToUint());
  }

  function verifyProofForBlockForFloat(
    uint256 _blockId,
    bytes32[] memory _proof,
    bytes memory _key,
    bytes memory _value
  ) public view returns (bool, uint256) {
    return (
      verifyProof(_proof, blocks[_blockId].data.root, hashLeaf(_key, _value)),
      _value.leafTo18DecimalsFloat()
    );
  }

  function getBlockData(uint256 _blockId) external view returns (Block memory) {
    return blocks[_blockId].data;
  }

  function getBlockRoot(uint256 _blockId) external view returns (bytes32) {
    return blocks[_blockId].data.root;
  }

  function getBlockMinter(uint256 _blockId) external view returns (address) {
    return blocks[_blockId].data.minter;
  }

  function getBlockStaked(uint256 _blockId) external view returns (uint256) {
    return blocks[_blockId].data.staked;
  }

  function getBlockPower(uint256 _blockId) external view returns (uint256) {
    return blocks[_blockId].data.power;
  }

  function getBlockAnchor(uint256 _blockId) external view returns (uint256) {
    return blocks[_blockId].data.anchor;
  }

  function getBlockTimestamp(uint256 _blockId) external view returns (uint256) {
    return blocks[_blockId].data.timestamp;
  }

  function getBlockVotersCount(uint256 _blockId) external view returns (uint256) {
    return blocks[_blockId].voters.length;
  }

  function getBlockVoters(uint256 _blockId) external view returns (address[] memory) {
    return blocks[_blockId].voters;
  }

  function getBlockVotes(uint256 _blockId, address _voter) external view returns (uint256) {
    return blocks[_blockId].votes[_voter];
  }

  function getNumericFCD(uint256 _blockId, bytes32 _key) public view returns (uint256 value, uint timestamp) {
    ExtendedBlock storage extendedBlock = blocks[_blockId];
    return (extendedBlock.numericFCD[_key], extendedBlock.data.timestamp);
  }

  function getNumericFCDs(
    uint256 _blockId, bytes32[] calldata _keys
  ) external view returns (uint256[] memory values, uint256 timestamp) {
    timestamp = blocks[_blockId].data.timestamp;
    values = new uint256[](_keys.length);

    for (uint i=0; i<_keys.length; i++) {
      values[i] = blocks[_blockId].numericFCD[_keys[i]];
    }
  }

  function getCurrentValue(bytes32 _key) external view returns (uint256 value, uint timestamp) {
    // it will revert when no blocks
    return getNumericFCD(getLatestBlockId(), _key);
  }

  // ========== EVENTS ========== //

  event LogMint(address indexed minter, uint256 blockHeight, uint256 anchor);
  event LogBlockPadding(address indexed executor, uint256 blockPadding);
}
