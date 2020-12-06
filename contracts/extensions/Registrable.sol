//SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "../interfaces/IRegistry.sol";

abstract contract Registrable {
  IRegistry public registry;

  function getName() virtual external pure returns (bytes32);

  // ========== CONSTRUCTOR ========== //

  constructor(address _registry) internal {
    require(_registry != address(0x0), "_registry is empty");
    registry = IRegistry(registry);
  }

  // ========== MODIFIERS ========== //

  modifier onlyFromContract(address _msgSender, bytes32 _contractName) {
    require(
      registry.getAddress(_contractName) == _msgSender,
        string(abi.encodePacked('caller is not ', _contractName))
    );
    _;
  }
}
