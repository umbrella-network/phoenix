// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IValidatorRegistry.sol";
import "./extensions/Registrable.sol";

contract ValidatorRegistry is IValidatorRegistry, Ownable {
  struct Validator {
    address id;
    string location;
  }

  mapping(address => Validator) override public validators;

  address[] override public addresses;

  event LogValidatorRegistered(address id);
  event LogValidatorUpdated(address id);
  event LogValidatorRemoved(address id);

  function getName() override external pure returns (bytes32) {
    return "ValidatorRegistry";
  }

  function create(address _id, string calldata _location) override external onlyOwner {
    Validator storage validator = validators[_id];

    require(validator.id == address(0x0), "validator exists");

    validator.id = _id;
    validator.location = _location;

    addresses.push(validator.id);

    LogValidatorRegistered(validator.id);
  }

  function remove(address _id) external onlyOwner {
    require(validators[_id].id != address(0x0), "validator NOT exists");

    delete validators[_id];
    emit LogValidatorRemoved(_id);

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
