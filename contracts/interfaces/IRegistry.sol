//SPDX-License-Identifier: MIT
pragma solidity 0.8.13;


interface IRegistry {
    function getAddress(bytes32 name) external view returns (address);

    function requireAndGetAddress(bytes32 name) external view returns (address);
}
