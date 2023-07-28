// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "./StakingBankStatic.sol";


contract StakingBankStaticSbx is StakingBankStatic {
    address public constant VALIDATOR_0 = 0xE3bDa0C6E1fBB111091Dfef6f22a673b20Ea5F50;
    address public constant VALIDATOR_1 = 0xc1773490F00963CBAb3841fc07C1a0796E658Ba2;

    constructor(uint256 _validatorsCount) StakingBankStatic(_validatorsCount) {}

    function validators(address _id) external pure override returns (address id, string memory location) {
        if (_id == VALIDATOR_0) return (_id, "https://validator.sbx.umb.network");
        if (_id == VALIDATOR_1) return (_id, "https://validator2.sbx.umb.network");

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
