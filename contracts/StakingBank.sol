// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import '@openzeppelin/contracts/cryptography/MerkleProof.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import "./ValidatorRegistry.sol";

contract StakingBank is ReentrancyGuard {
  using SafeERC20 for IERC20;

  address public tokenAddress;
  address public registryAddress;

  constructor(
    address _tokenAddress,
    address _registryAddress
  ) public {
    tokenAddress = _tokenAddress;
    registryAddress = _registryAddress;
  }

  uint256 public staked;
  mapping(address => uint256) public balances;

  function receiveApproval(
    address _from,
    uint256 _value,
    address _token,
    bytes memory _data
  ) public nonReentrant returns (bool success) {
    require(_token == tokenAddress);

    ValidatorRegistry registry = ValidatorRegistry(registryAddress);
    (address id, ) = registry.validators(_from);

    require(id != address(0x0), "sender does not exist in registry");

    IERC20 token = IERC20(tokenAddress);
    uint256 allowance = token.allowance(_from, address(this));

    require(allowance > 0);

    balances[_from] += allowance;

    token.safeTransferFrom(_from, address(this), allowance);

    return true;
  }

  function withdraw(uint256 _value) public nonReentrant returns (bool success) {
    uint256 balance = balances[msg.sender];

    require(_value > 0 && balance >= _value);

    IERC20 token = IERC20(tokenAddress);

    balances[msg.sender] -= _value;

    token.safeTransfer(msg.sender, _value);

    return true;
  }
}
