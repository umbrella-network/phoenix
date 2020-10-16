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
    mapping(address => uint256) votes;
  }

  mapping (uint256 => Block) public blocks;

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
    uint8[] memory _v,
    bytes32[] memory _r,
    bytes32[] memory _s
  ) public nonReentrant {
    uint256 blockHeight = getBlockHeight();
    address leaderAddress = getLeaderAddress();

    require(msg.sender == leaderAddress, "sender is not the leader");

    bytes32 header = keccak256(abi.encodePacked(blockHeight, _root));
    uint256 staked = stakingBank.totalSupply();
    uint256 power = 0;
    uint256 minimum = staked.mul(66); 

    for (uint256 i = 0; i < _v.length; i = i.add(1)) {
      address signer = ecrecover(header, _v[i], _r[i], _s[i]);
      uint256 balance = stakingBank.balanceOf(signer);

      require(balance > 0, "validator does not have positive balance");
      require(blocks[blockHeight].votes[signer] == 0, "validator included more than once");

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
