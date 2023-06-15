// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "./StakingBankStatic.sol";


contract StakingBankStaticCI is StakingBankStatic {
    // 0x87630b2d1de0fbd5044eb6891b3d9d98c34c8d310c852f98550ba774480e47cc
    address public constant VALIDATOR_0 = address(0x2fFd013AaA7B5a7DA93336C2251075202b33FB2B);
    // 0x3f1e8b94c70206bf816c1ed0b15ad98bdf225ae4c6e7e4eee6cdbcf706fda2ae
    address public constant VALIDATOR_1 = address(0x43158ea338Ff13D0bDa0c3EB969B9EA5a624E7Cc);
    // 0x5da6b84117504d06b5dcd52b990d76965d2882f4e5852eb610bc76e4209b10d7
    address public constant VALIDATOR_2 = address(0x9Fd8DD0627b9A32399Fd115c4725C7e17BC40e6d);
    // 0x1e5012671de3332ad0b43661984e94ab0e405bffddc9d3e863055040bab354b8
    address public constant VALIDATOR_3 = address(0xa3F3659E469b7aE0b249546338DEdc0b684edB05);
    // 0x0edc1e35ea7701ddac703286674e79f04addbf5d2f6162fabc19d39bd3dc6662
    address public constant VALIDATOR_4 = address(0xB98A954B9036DF144d685E910bfbAEC6B33A8d11);
    // 0x23c601ae397441f3ef6f1075dcb0031ff17fb079837beadaf3c84d96c6f3e569
    address public constant VALIDATOR_5 = address(0xE5904695748fe4A84b40b3fc79De2277660BD1D3);


    constructor(uint256 _validatorsCount) StakingBankStatic(_validatorsCount) {}

    function validators(address _id) external pure override returns (address id, string memory location) {
        if (_id == VALIDATOR_0) return (_id, "https://validator.ci.umb.network");
        if (_id == VALIDATOR_1) return (_id, "https://validator2.ci.umb.network");
        if (_id == VALIDATOR_2) return (_id, "https://validator3.ci.umb.network");
        if (_id == VALIDATOR_3) return (_id, "https://validator4.ci.umb.network");
        if (_id == VALIDATOR_4) return (_id, "https://validator5.ci.umb.network");
        if (_id == VALIDATOR_5) return (_id, "https://validator6.ci.umb.network");

        return (address(0), "");
    }

    function _addresses() internal view override returns (address[] memory) {
        address[] memory list = new address[](NUMBER_OF_VALIDATORS);

        list[0] = VALIDATOR_0;
        list[1] = VALIDATOR_1;
        list[2] = VALIDATOR_2;
        list[3] = VALIDATOR_3;
        list[4] = VALIDATOR_4;
        list[5] = VALIDATOR_5;

        return list;
    }

    function _isValidator(address _validator) internal pure override returns (bool) {
        return (_validator == VALIDATOR_0
            || _validator == VALIDATOR_1
            || _validator == VALIDATOR_2
            || _validator == VALIDATOR_3
            || _validator == VALIDATOR_4
            || _validator == VALIDATOR_5
        );
    }
}
