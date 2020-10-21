// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interfaces/IStakingBank.sol";
import "./interfaces/IValidatorRegistry.sol";

contract Chain is ReentrancyGuard {
  using SafeMath for uint256;

  IValidatorRegistry validatorRegistry;
  IStakingBank stakingBank;
  uint256 interval;

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

    for (uint256 i = 0; i < _keys.length; i = i.add(1)) {
      blocks[blockHeight].data[_keys[i]] = _values[i];
      testimony = abi.encodePacked(testimony, _keys[i], _values[i]);
    }

    uint256 staked = stakingBank.totalSupply();
    uint256 power = 0;
    uint256 minimum = staked.mul(66); 

    bytes32 affidavit = keccak256(testimony);

    for (uint256 i = 0; i < _v.length; i = i.add(1)) {
      address signer = ecrecover(affidavit, _v[i], _r[i], _s[i]);
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
}
