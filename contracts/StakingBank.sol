// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import '@openzeppelin/contracts/cryptography/MerkleProof.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import "./interfaces/IERC20Detailed.sol";
import "./interfaces/IStakingBank.sol";
import "./interfaces/IValidatorRegistry.sol";

contract StakingBank is IStakingBank, ERC20, ReentrancyGuard {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  IERC20 public token;
  IValidatorRegistry public registry;

  constructor(
    address _tokenAddress,
    address _registryAddress
  ) ERC20(
      string(abi.encodePacked("staked ", IERC20Detailed(_tokenAddress).name())),
      string(abi.encodePacked("sb", IERC20Detailed(_tokenAddress).symbol()))
    ) public {
    require(_tokenAddress != address(0x0), "_tokenAddress is missing");
    require(_registryAddress != address(0x0), "_registryAddress is missing");

    token = IERC20(_tokenAddress);
    registry = IValidatorRegistry(_registryAddress);
  }

  function receiveApproval(
    address _from,
    uint256 _value,
    bytes calldata _data
  ) override external nonReentrant returns (bool success) {
    (address id, ) = registry.validators(_from);

    require(id != address(0x0), "validator does not exist in registry");

    uint256 allowance = token.allowance(_from, address(this));
    require(allowance > 0, "contract not allowed to spend tokens");

    token.safeTransferFrom(_from, address(this), allowance);
    _mint(_from, allowance);

    return true;
  }

  function withdraw(uint256 _value) override external nonReentrant returns (bool success) {
    uint256 balance = balanceOf(msg.sender);

    require(_value > 0, "empty withdraw value");
    require(balance >= _value, "can't withdraw more than balance");

    _burn(msg.sender, _value);
    token.safeTransfer(msg.sender, _value);

    return true;
  }
}
