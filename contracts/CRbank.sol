// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "hardhat/console.sol";


contract CRbank {
    struct FirstClassDataSquashed {
        uint64 value1; // 32: 429_496.7296n
        uint64 value2;
        uint64 value3;
        uint64 dataTimestamp;
    }

    mapping(address => bool) public balanceOf;
    address[] public validators;
    FirstClassDataSquashed public data;

    constructor() {
        data.dataTimestamp = 123;
        data.value1 = 1;
        data.value2 = 2;
        data.value3 = 3;
    }

    function allValidators() external view returns (address[] memory) {
        return validators;
    }

    function value1() external view returns (uint256 value, uint256 t) {
        FirstClassDataSquashed storage d = data;
        value = d.value1;
        t = d.dataTimestamp;
    }

    function bothValues() external view returns (uint256 value1, uint256 value2, uint256 t) {
        FirstClassDataSquashed storage d = data;
        value1 = d.value1;
        value2 = d.value2;
        t = d.dataTimestamp;
    }

    function saveBalance(address[] calldata _addresses) external {
        for (uint i; i < _addresses.length; i++) {
            balanceOf[_addresses[i]] = true;
        }

        validators = _addresses;
    }
}
