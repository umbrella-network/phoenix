// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "./StakingBankStatic.sol";


contract StakingBankStaticLocal is StakingBankStatic {
    address public constant VALIDATOR_0 = address(0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4);

    constructor(uint256 _validatorsCount) StakingBankStatic(_validatorsCount) {}

    function validators(address _id) external pure override returns (address id, string memory location) {
        if (_id == VALIDATOR_0) return (_id, "localhost");

        return (address(0), "");
    }

    function _addresses() internal view override returns (address[] memory) {
        address[] memory list = new address[](NUMBER_OF_VALIDATORS);

        list[0] = VALIDATOR_0;

        return list;
    }

    function _isValidator(address _validator) internal pure override returns (bool) {
        return (_validator == VALIDATOR_0);
    }
}
