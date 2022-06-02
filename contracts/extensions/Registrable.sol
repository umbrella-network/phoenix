//SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IRegistry.sol";
import "../interfaces/IStakingBank.sol";

/// @dev Any contract that we want to register in ContractRegistry, must inherit from Registrable
abstract contract Registrable {
  IRegistry public immutable contractRegistry;

  modifier onlyFromContract(address _msgSender, bytes32 _contractName) {
    require(
      contractRegistry.getAddress(_contractName) == _msgSender,
      string(abi.encodePacked("caller is not ", _contractName))
    );
    _;
  }

  modifier withRegistrySetUp() {
    require(address(contractRegistry) != address(0x0), "_registry is empty");
    _;
  }

  constructor(IRegistry _contractRegistry) {
    require(address(_contractRegistry) != address(0x0), "_registry is empty");
    contractRegistry = _contractRegistry;
  }

  /// @dev this is required only for ForeignChain
  /// in order to use this method, we need new registry
  function register() virtual external {
    // for backward compatibility the body is implemented as empty
  }

  /// @dev this is required only for ForeignChain
  /// in order to use this method, we need new registry
  function unregister() virtual external {
    // for backward compatibility the body is implemented as empty
  }

  /// @return contract name as bytes32
  function getName() virtual external pure returns (bytes32);

  /// @dev helper method for fetching StakingBank address
  function stakingBankContract() public view returns (IStakingBank) {
    return IStakingBank(contractRegistry.requireAndGetAddress("StakingBank"));
  }

  /// @dev helper method for fetching UMB address
  function tokenContract() public view withRegistrySetUp returns (ERC20) {
    return ERC20(contractRegistry.requireAndGetAddress("UMB"));
  }
}
