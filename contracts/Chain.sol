// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/cryptography/MerkleProof.sol";

import "./interfaces/IStakingBank.sol";
import "./interfaces/IValidatorRegistry.sol";

contract Chain is ReentrancyGuard {
  using SafeMath for uint256;

  IValidatorRegistry public validatorRegistry;
  IStakingBank public stakingBank;
  uint256 public interval;

  bytes constant ETH_PREFIX = "\x19Ethereum Signed Message:\n32";

  struct Block {
    bytes32 root;
    address minter;
    uint256 staked;
    uint256 power;
    address[] voters;
    uint256 anchor;
    uint256 timestamp;
    mapping(address => uint256) votes;
    mapping(bytes32 => bytes32) data;
  }

  mapping (uint256 => Block) public blocks;

  event LogMint(address indexed minter, uint256 blockHeight, uint256 anchor);

  constructor(
    address _registryAddress,
    address _bankAddress,
    uint256 _interval
  ) public {
    require(_registryAddress != address(0x0), "_registryAddress is missing");
    require(_bankAddress != address(0x0), "_bankAddress is missing");

    validatorRegistry = IValidatorRegistry(_registryAddress);
    stakingBank = IStakingBank(_bankAddress);
    interval = _interval;
  }

  function recoverSigner(bytes32 affidavit, uint8 _v, bytes32 _r, bytes32 _s) public pure returns (address) {
    bytes32 hash = keccak256(abi.encodePacked(ETH_PREFIX, affidavit));
    return ecrecover(hash, _v, _r, _s);
  }

  function submit(
    bytes32 _root,
    bytes32[] memory _keys,
    bytes32[] memory _values,
    uint8[] memory _v,
    bytes32[] memory _r,
    bytes32[] memory _s
  ) public nonReentrant returns (bool) {
    uint256 blockHeight = getBlockHeight();
    address leaderAddress = getLeaderAddress();

    bytes memory testimony = abi.encodePacked(blockHeight, _root);

    require(msg.sender == leaderAddress, "sender is not the leader");
    require(_keys.length == _values.length, "numbers of keys and values not the same");

    for (uint256 i = 0; i < _keys.length; i++) {
      blocks[blockHeight].data[_keys[i]] = _values[i];
      testimony = abi.encodePacked(testimony, _keys[i], _values[i]);
    }

    uint256 staked = stakingBank.totalSupply();
    uint256 power = 0;
    uint256 minimum = staked.mul(66);

    bytes32 affidavit = keccak256(testimony);

    for (uint256 i = 0; i < _v.length; i++) {
      address signer = recoverSigner(affidavit, _v[i], _r[i], _s[i]);
      uint256 balance = stakingBank.balanceOf(signer);

      require(balance > 0, "validator does not have positive balance");
      require(blocks[blockHeight].votes[signer] == 0, "validator included more than once");

      blocks[blockHeight].voters.push(signer);

      blocks[blockHeight].votes[signer] = balance;
      power = power.add(balance);

      if (power.mul(100) > minimum) {
        break;
      }
    }

    require(power.mul(100) > minimum, "not enough power was gathered");

    blocks[blockHeight].root = _root;
    blocks[blockHeight].minter = leaderAddress;
    blocks[blockHeight].staked = staked;
    blocks[blockHeight].power = power;
    blocks[blockHeight].anchor = block.number;
    blocks[blockHeight].timestamp = block.timestamp;

    emit LogMint(msg.sender, blockHeight, block.number);

    return true;
  }

  function getBlockHeight() public view returns (uint256) {
    return block.number.div(uint256(interval));
  }

  // @todo - properly handled non-enabled validators, newly added validators, and validators with low stake
  function getLeaderAddress() public view returns (address) {
    uint256 numberOfValidators = validatorRegistry.getNumberOfValidators();

    if (numberOfValidators == 0) {
      return address(0x0);
    }

    uint256 blockHeight = getBlockHeight();
    uint256 index = uint256(blockHeight.mod(numberOfValidators));
    address leader = validatorRegistry.addresses(index);
    return leader;
  }

  function verifyProof(bytes32[] memory _proof, bytes32 _root, bytes32 _leaf) public view returns (bool) {
    if (_root == bytes32(0)) {
      return false;
    }

    return MerkleProof.verify(_proof, _root, _leaf);
  }

  function leafHash(bytes memory _key, bytes memory _value) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(_key, _value));
  }

  function verifyProofForBlock(
    uint256 _blockHeight,
    bytes32[] memory _proof,
    bytes memory _key,
    bytes memory _value
  ) public view returns (bool) {
    return verifyProof(_proof, blocks[_blockHeight].root, leafHash(_key, _value));
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
          blocks[_blockHeights[i]].root,
          _leaves[i]
      );

      offset += _proofItemsCounter[i];
    }
  }
}
