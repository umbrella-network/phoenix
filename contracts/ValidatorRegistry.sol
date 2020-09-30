// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import '@openzeppelin/contracts/access/Ownable.sol';

contract ValidatorRegistry is Ownable {
  event LogValidatorRegistered(
    address id
  );

  event LogValidatorUpdated(
    address id
  );

  struct Validator {
    address id;
    string location;
  }

  mapping(address => Validator) public validators;

  address[] public addresses;

  function create(address _id, string memory _location) public onlyOwner {
    Validator storage validator = validators[_id];

    require(validator.id == address(0x0));

    validator.id = _id;
    validator.location = _location;

    addresses.push(validator.id);

    LogValidatorRegistered(validator.id);
  }

  function update(address _id, string memory _location) public onlyOwner {
    Validator storage validator = validators[_id];

    require(validator.id != address(0x0));

    validator.location = _location;

    LogValidatorUpdated(validator.id);
  }

  function getNumberOfValidators() public view returns (uint256) {
    return addresses.length;
  }
}
