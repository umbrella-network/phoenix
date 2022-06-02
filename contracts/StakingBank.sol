// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IStakingBank.sol";
import "./extensions/Registrable.sol";
import "./Registry.sol";

contract StakingBank is IStakingBank, ERC20, ReentrancyGuard, Registrable, Ownable {
  using SafeERC20 for ERC20;

  struct Validator {
    address id;
    string location;
  }

  mapping(address => Validator) public override validators;

  ERC20 public immutable token;
  address[] public override addresses;
  uint256 public minAmountForStake; // minimum amount of tokens that we accept for staking

  event LogValidatorRegistered(address indexed id);
  event LogValidatorUpdated(address indexed id);
  event LogValidatorRemoved(address indexed id);
  event LogMinAmountForStake(uint256 minAmountForStake);

  error NoChangeToState();
  error ValueMustBePositive();
  error TransferDenied();
  error NotEnoughBalance();
  error MinimalStakeAmountRequired();
  error ValidatorNotExists();
  error ValidatorAlreadyExists();

  constructor(
    IRegistry _contractRegistry,
    uint256 _minAmountForStake,
    string memory _name,
    string memory _symbol
  )
    Registrable(_contractRegistry)
    ERC20(string.concat("staked ", _name), string.concat("sb", _symbol))
  {
    token = ERC20(_contractRegistry.requireAndGetAddress("UMB"));
    _setMinAmountForStake(_minAmountForStake);
  }

  function getName() external pure override returns (bytes32) {
    return "StakingBank";
  }

  function setMinAmountForStake(uint256 _minAmountForStake) external onlyOwner {
    _setMinAmountForStake(_minAmountForStake);
  }

  function _setMinAmountForStake(uint256 _minAmountForStake) internal {
    if (minAmountForStake == _minAmountForStake) revert NoChangeToState();
    if (_minAmountForStake == 0) revert ValueMustBePositive();

    minAmountForStake = _minAmountForStake;
    emit LogMinAmountForStake(_minAmountForStake);
  }

  function _transfer(address, address, uint256) internal pure override {
    revert TransferDenied();
  }

  function stake(uint256 _value) external nonReentrant {
    _stake(msg.sender, _value);
  }

  function receiveApproval(address _from) override external nonReentrant returns (bool success) {
    uint256 allowance = token.allowance(_from, address(this));

    _stake(_from, allowance);

    return true;
  }

  function withdraw(uint256 _value) override external nonReentrant returns (bool success) {
    uint256 balance = balanceOf(msg.sender);
    if (_value > balance) revert NotEnoughBalance();

    unchecked {
      // underflow is not possible because we checked for `_value > balance`
      // minAmountForStake must be available, use exit to withdraw all
      if (balance - _value < minAmountForStake) revert MinimalStakeAmountRequired();
    }

    _unstake(msg.sender, _value);
    return true;
  }

  function exit() external nonReentrant returns (bool success) {
    uint256 balance = balanceOf(msg.sender);
    _unstake(msg.sender, balance);
    return true;
  }

  function _stake(address _from, uint256 _amount) internal {
    if (validators[_from].id == address(0x0)) revert ValidatorNotExists();
    if (balanceOf(_from) + _amount < minAmountForStake) revert MinimalStakeAmountRequired();

    token.safeTransferFrom(_from, address(this), _amount);
    _mint(_from, _amount);
  }

  function _unstake(address _validator, uint256 _value) internal {
    if (_value == 0) revert ValueMustBePositive();

    _burn(_validator, _value);
    token.safeTransfer(_validator, _value);
  }

  function create(address _id, string calldata _location) override external onlyOwner {
    Validator storage validator = validators[_id];

    if (validator.id != address(0x0)) revert ValidatorAlreadyExists();

    validator.id = _id;
    validator.location = _location;

    addresses.push(validator.id);

    emit LogValidatorRegistered(validator.id);
  }

  function remove(address _id) external onlyOwner {
    if (validators[_id].id == address(0x0)) revert ValidatorNotExists();

    delete validators[_id];
    emit LogValidatorRemoved(_id);

    uint256 balance = balanceOf(_id);

    if (balance != 0) {
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

    if (validator.id == address(0x0)) revert ValidatorNotExists();

    validator.location = _location;

    emit LogValidatorUpdated(validator.id);
  }

  function getNumberOfValidators() override external view returns (uint256) {
    return addresses.length;
  }
}
