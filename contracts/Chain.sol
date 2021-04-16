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
    uint256 _dataTimestamp,
    bytes32 _root,
    bytes32[] memory _keys,
    uint256[] memory _values,
    uint8[] memory _v,
    bytes32[] memory _r,
    bytes32[] memory _s
  ) public nonReentrant returns (bool) {
    uint256 blockHeight = getBlockHeight();
    require(blocks[blockHeight].data.anchor == 0, "block already mined for current blockHeight");
    // in future we can add timePadding and remove blockPadding
    require(blocks[blockHeight - 1].data.dataTimestamp < _dataTimestamp, "can NOT submit older data");

    bytes memory testimony = abi.encodePacked(blockHeight, _dataTimestamp, _root);

    require(_keys.length == _values.length, "numbers of keys and values not the same");

    for (uint256 i = 0; i < _keys.length; i++) {
      blocks[blockHeight].numericFCD[_keys[i]] = _values[i];
      testimony = abi.encodePacked(testimony, _keys[i], _values[i]);
    }

    bytes32 affidavit = keccak256(testimony);

    (blocks[blockHeight].data.staked, blocks[blockHeight].data.power) =
      _validateSignatures(blockHeight, affidavit, _v, _r, _s);

    blocks[blockHeight].data.root = _root;
    blocks[blockHeight].data.minter = msg.sender; //TODO check if validator is registered
    blocks[blockHeight].data.anchor = block.number;
    blocks[blockHeight].data.timestamp = block.timestamp;
    blocks[blockHeight].data.dataTimestamp = _dataTimestamp;

    blocksCount++;

    emit LogMint(msg.sender, blockHeight, block.number);

    return true;
  }

  function _validateSignatures(
    uint256 _blockHeight,
    bytes32 _affidavit,
    uint8[] memory _v,
    bytes32[] memory _r,
    bytes32[] memory _s
  ) internal returns (uint256 staked, uint256 power){
    IStakingBank stakingBank = stakingBankContract();
    staked = stakingBank.totalSupply();

    power = 0;

    for (uint256 i = 0; i < _v.length; i++) {
      address signer = recoverSigner(_affidavit, _v[i], _r[i], _s[i]);
      uint256 balance = stakingBank.balanceOf(signer);
      require(blocks[_blockHeight].votes[signer] == 0, "validator included more than once");

      if (balance == 0) {
        // if no balance -> move on, it can be invalid address but also fresh validator with no balance
        // we can spend gas and check if address is validator address, but I see no point, its cheaper to ignore
        // if we calculated root for other blockHeight, then recovering signer will not work -> move on
        continue;
      }

      blocks[_blockHeight].voters.push(signer);
      blocks[_blockHeight].votes[signer] = balance;
      power = power.add(balance);
    }

    require(power.mul(100) > staked.mul(66), "not enough power was gathered");
  }

  // ========== VIEWS ========== //

  function getName() override external pure returns (bytes32) {
    return "Chain";
  }

  function recoverSigner(bytes32 affidavit, uint8 _v, bytes32 _r, bytes32 _s) public pure returns (address) {
    bytes32 hash = keccak256(abi.encodePacked(ETH_PREFIX, affidavit));
    return ecrecover(hash, _v, _r, _s);
  }

  function getStatus() external view returns(
    uint256 blockNumber,
    uint256 lastDataTimestamp,
    uint256 lastBlockHeight,
    address nextLeader,
    uint256 nextBlockHeight,
    address[] memory validators,
    uint256[] memory powers,
    string[] memory locations,
    uint256 staked
  ) {
    blockNumber = block.number;
    lastBlockHeight = getLatestBlockHeightWithData();
    lastDataTimestamp = blocks[lastBlockHeight].data.dataTimestamp;

    IValidatorRegistry vr = validatorRegistryContract();
    uint256 numberOfValidators = vr.getNumberOfValidators();
    validators = new address[](numberOfValidators);
    locations = new string[](numberOfValidators);

    for (uint256 i = 0; i < numberOfValidators; i++) {
      validators[i] = vr.addresses(i);
      (, locations[i]) = vr.validators(validators[i]);
    }

    nextLeader = numberOfValidators > 0 ? validators[getLeaderIndex(numberOfValidators, block.number + 1)] : address(0);

    IStakingBank stakingBank = stakingBankContract();
    powers = new uint256[](numberOfValidators);
    staked = stakingBank.totalSupply();

    for (uint256 i = 0; i < numberOfValidators; i++) {
      powers[i] = stakingBank.balanceOf(validators[i]);
    }

    nextBlockHeight = getBlockHeight();
  }

  function getBlockHeight() public view returns (uint256) {
    uint _blocksCount = blocksCount + blocksCountOffset;

    if (_blocksCount == 0) {
      return 0;
    }

    if (blocks[_blocksCount - 1].data.anchor + blockPadding < block.number) {
      return _blocksCount;
    }

    return _blocksCount - 1;
  }

  function getLatestBlockHeightWithData() public view returns (uint256) {
    return blocksCount + blocksCountOffset - 1;
  }

  function getLeaderIndex(uint256 numberOfValidators, uint256 ethBlockNumber) public view returns (uint256) {
    uint256 latestBlockHeight = getLatestBlockHeightWithData();

    uint256 validatorIndex = latestBlockHeight +
      (ethBlockNumber - blocks[latestBlockHeight].data.anchor) / blockPadding;

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
    uint256 _blockHeight,
    bytes32[] memory _proof,
    bytes memory _key,
    bytes memory _value
  ) public view returns (bool) {
    return verifyProof(_proof, blocks[_blockHeight].data.root, hashLeaf(_key, _value));
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
    uint256[] memory _blockHeights,
    bytes memory _proofs,
    uint256[] memory _proofItemsCounter,
    bytes32[] memory _leaves
  ) public view returns (bool[] memory results) {
    results = new bool[](_leaves.length);
    uint256 offset = 0;

    for (uint256 i = 0; i < _leaves.length; i++) {
      results[i] = verifyProof(
        bytesToBytes32Array(_proofs, offset, _proofItemsCounter[i]),
        blocks[_blockHeights[i]].data.root,
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
    uint256 _blockHeight,
    bytes32[] memory _proof,
    bytes memory _key,
    bytes memory _value
  ) public view returns (bool, uint256) {
    return (verifyProof(_proof, blocks[_blockHeight].data.root, hashLeaf(_key, _value)), _value.leafToUint());
  }

  function verifyProofForBlockForFloat(
    uint256 _blockHeight,
    bytes32[] memory _proof,
    bytes memory _key,
    bytes memory _value
  ) public view returns (bool, uint256) {
    return (
      verifyProof(_proof, blocks[_blockHeight].data.root, hashLeaf(_key, _value)),
      _value.leafTo18DecimalsFloat()
    );
  }

  function getBlockData(uint256 _blockHeight) external view returns (Block memory) {
    return blocks[_blockHeight].data;
  }

  function getBlockRoot(uint256 _blockHeight) external view returns (bytes32) {
    return blocks[_blockHeight].data.root;
  }

  function getBlockMinter(uint256 _blockHeight) external view returns (address) {
    return blocks[_blockHeight].data.minter;
  }

  function getBlockStaked(uint256 _blockHeight) external view returns (uint256) {
    return blocks[_blockHeight].data.staked;
  }

  function getBlockPower(uint256 _blockHeight) external view returns (uint256) {
    return blocks[_blockHeight].data.power;
  }

  function getBlockAnchor(uint256 _blockHeight) external view returns (uint256) {
    return blocks[_blockHeight].data.anchor;
  }

  function getBlockTimestamp(uint256 _blockHeight) external view returns (uint256) {
    return blocks[_blockHeight].data.timestamp;
  }

  function getBlockVotersCount(uint256 _blockHeight) external view returns (uint256) {
    return blocks[_blockHeight].voters.length;
  }

  function getBlockVoters(uint256 _blockHeight) external view returns (address[] memory) {
    return blocks[_blockHeight].voters;
  }

  function getBlockVotes(uint256 _blockHeight, address _voter) external view returns (uint256) {
    return blocks[_blockHeight].votes[_voter];
  }

  function getNumericFCD(uint256 _blockHeight, bytes32 _key) public view returns (uint256 value, uint timestamp) {
    ExtendedBlock storage extendedBlock = blocks[_blockHeight];
    return (extendedBlock.numericFCD[_key], extendedBlock.data.timestamp);
  }

  function getNumericFCDs(
    uint256 _blockHeight, bytes32[] calldata _keys
  ) external view returns (uint256[] memory values, uint256 timestamp) {
    timestamp = blocks[_blockHeight].data.timestamp;
    values = new uint256[](_keys.length);

    for (uint i=0; i<_keys.length; i++) {
      values[i] = blocks[_blockHeight].numericFCD[_keys[i]];
    }
  }

  function getCurrentValue(bytes32 _key) external view returns (uint256 value, uint timestamp) {
    // it will revert when no blocks
    return getNumericFCD(getLatestBlockHeightWithData(), _key);
  }

  // ========== EVENTS ========== //

  event LogMint(address indexed minter, uint256 blockHeight, uint256 anchor);
  event LogBlockPadding(address indexed executor, uint256 blockPadding);
}
