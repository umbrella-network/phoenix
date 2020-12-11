//SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "@nomiclabs/buidler/console.sol";


import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IRegistry.sol";
import "../interfaces/IStakingBank.sol";
import "../interfaces/IValidatorRegistry.sol";

abstract contract Registrable {
  IRegistry public contractRegistry;

  function getName() virtual external pure returns (bytes32);

  // ========== CONSTRUCTOR ========== //

  constructor(address _contractRegistry) internal {
    require(_contractRegistry != address(0x0), "_registry is empty");
    contractRegistry = IRegistry(_contractRegistry);
  }

  // ========== MODIFIERS ========== //

  modifier onlyFromContract(address _msgSender, bytes32 _contractName) {
    require(
      contractRegistry.getAddress(_contractName) == _msgSender,
        string(abi.encodePacked('caller is not ', _contractName))
    );
    _;
  }

  modifier withRegistrySetUp() {
    require(address(contractRegistry) != address(0x0), "_registry is empty");
    _;
  }

  // ========== VIEWS ========== //

  function validatorRegistryContract() public view returns (IValidatorRegistry) {
    return IValidatorRegistry(contractRegistry.requireAndGetAddress('ValidatorRegistry'));
  }

  function stakingBankContract() public view returns (IStakingBank) {
    return IStakingBank(contractRegistry.requireAndGetAddress('StakingBank'));
  }

  function tokenContract() withRegistrySetUp public view returns (ERC20) {
    return ERC20(contractRegistry.requireAndGetAddress('UMB'));
  }
}
