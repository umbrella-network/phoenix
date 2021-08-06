// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IERC20Detailed.sol";
import "./interfaces/IStakingBank.sol";

import "./extensions/Registrable.sol";

import "./Registry.sol";

contract StakingBank is IStakingBank, ERC20, ReentrancyGuard, Registrable, Ownable {
  using SafeERC20 for ERC20;
  using SafeMath for uint256;

  struct Validator {
    address id;
    string location;
  }

  mapping(address => Validator) override public validators;

  address[] override public addresses;

  event LogValidatorRegistered(address id);
  event LogValidatorUpdated(address id);
  event LogValidatorRemoved(address id);

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

  // solhint-disable-next-line no-unused-vars
  function _transfer(address sender, address recipient, uint256 amount) internal override {
    revert("staked tokens can not be transferred");
  }

  function stake(uint256 _value) external nonReentrant {
    ERC20 token = tokenContract();

    _stake(token, msg.sender, _value);
  }


  function receiveApproval(address _from) override external nonReentrant returns (bool success) {
    ERC20 token = tokenContract();
    uint256 allowance = token.allowance(_from, address(this));

    _stake(token, _from, allowance);

    return true;
  }

  function withdraw(uint256 _value) override external nonReentrant returns (bool success) {
    uint256 balance = balanceOf(msg.sender);
    require(balance >= _value, "can't withdraw more than balance");

    _unstake(msg.sender, _value);
    return true;
  }

  function _stake(ERC20 _token, address _from, uint256 _amount) internal {
    require(_amount > 0, "_amount is empty");
    require(validators[_from].id != address(0x0), "validator does not exist in registry");

    _token.safeTransferFrom(_from, address(this), _amount);
    _mint(_from, _amount);
  }

  function _unstake(address _validator, uint256 _value) internal {
    require(_value > 0, "empty withdraw value");

    _burn(_validator, _value);
    tokenContract().safeTransfer(_validator, _value);
  }

  function create(address _id, string calldata _location) override external onlyOwner {
    Validator storage validator = validators[_id];

    require(validator.id == address(0x0), "validator exists");
    validator.id = _id;
    validator.location = _location;

    addresses.push(validator.id);

    emit LogValidatorRegistered(validator.id);
  }

  function remove(address _id) external onlyOwner {
    require(validators[_id].id != address(0x0), "validator NOT exists");

    delete validators[_id];
    emit LogValidatorRemoved(_id);

    uint256 balance = balanceOf(_id);
    if (balance > 0) {
      _unstake(_id, balanceOf(_id));
    }

    if (addresses.length == 1) {
      addresses.pop();
      return;
    }

    for (uint256 i = 0; i < addresses.length; i++) {
      if (addresses[i] == _id) {
        addresses[i] = addresses[addresses.length - 1];
        addresses.pop();
        return;
      }
    }
  }

  function update(address _id, string calldata _location) override external onlyOwner {
    Validator storage validator = validators[_id];

    require(validator.id != address(0x0), "validator does not exist");

    validator.location = _location;

    LogValidatorUpdated(validator.id);
  }

  function getNumberOfValidators() override external view returns (uint256) {
    return addresses.length;
  }
}
