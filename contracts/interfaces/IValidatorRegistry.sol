// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

interface IValidatorRegistry {
  function validators(address _id) external view returns (address id, string memory location);

  function addresses(uint256 _ix) external view returns (address);

  function create(address _id, string calldata _location) external;

  function update(address _id, string calldata _location) external;

  function getNumberOfValidators() external view returns (uint256);
}
