// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import "hardhat/console.sol";

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./interfaces/IERC20Detailed.sol";
import "./interfaces/IStakingBank.sol";
import "./interfaces/IValidatorRegistry.sol";

import "./extensions/Registrable.sol";

import "./Registry.sol";

contract StakingBank is IStakingBank, ERC20, ReentrancyGuard, Registrable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  constructor(address _contractRegistry, string memory _name, string memory _symbol)
  public
  Registrable(_contractRegistry)
  ERC20(
      string(abi.encodePacked("staked ", _name)),
      string(abi.encodePacked("sb", _symbol))
    ) {
  }

  function getName() override external pure returns (bytes32) {
    return "StakingBank";
  }

  function receiveApproval(
    address _from,
    uint256 _value,
    bytes calldata _data
  ) override external nonReentrant returns (bool success) {
    IValidatorRegistry registry = validatorRegistryContract();
    IERC20 token = tokenContract();

    (address id, ) = registry.validators(_from);

    require(id != address(0x0), "validator does not exist in registry");

    uint256 allowance = token.allowance(_from, address(this));
    require(allowance > 0, "contract not allowed to spend tokens");

    token.safeTransferFrom(_from, address(this), allowance);
    _mint(_from, allowance);

    return true;
  }

  function withdraw(uint256 _value) override external nonReentrant returns (bool success) {
    IERC20 token = tokenContract();
    uint256 balance = balanceOf(msg.sender);

    require(_value > 0, "empty withdraw value");
    require(balance >= _value, "can't withdraw more than balance");

    _burn(msg.sender, _value);
    token.safeTransfer(msg.sender, _value);

    return true;
  }
}
