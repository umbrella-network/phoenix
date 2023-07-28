// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "./IStakingBank.sol";


interface IStakingBankStatic is IStakingBank {
    /// @param _validators array of validators addresses to verify
    /// @return TRUE when all validators are valid, FALSE otherwise
    function verifyValidators(address[] calldata _validators) external view returns (bool);
}
