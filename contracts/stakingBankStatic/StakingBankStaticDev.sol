// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "./StakingBankStatic.sol";


contract StakingBankStaticDev is StakingBankStatic {
    address public constant VALIDATOR_0 = address(0xDc3eBc37DA53A644D67E5E3b5BA4EEF88D969d5C);
    address public constant VALIDATOR_1 = address(0x998cb7821e605cC16b6174e7C50E19ADb2Dd2fB0);

    constructor(uint256 _validatorsCount) StakingBankStatic(_validatorsCount) {}

    function validators(address _id) external pure override returns (address id, string memory location) {
        if (_id == VALIDATOR_0) return (_id, "https://validator.dev.umb.network");
        if (_id == VALIDATOR_1) return (_id, "https://validator2.dev.umb.network");

        return (address(0), "");
    }

    function _addresses() internal view override returns (address[] memory) {
        address[] memory list = new address[](NUMBER_OF_VALIDATORS);

        list[0] = VALIDATOR_0;
        list[1] = VALIDATOR_1;

        return list;
    }

    function _isValidator(address _validator) internal pure override returns (bool) {
        return (_validator == VALIDATOR_0 || _validator == VALIDATOR_1);
    }
}
