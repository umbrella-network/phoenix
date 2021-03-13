// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStakingBank is IERC20 {
  function receiveApproval(address _from) external returns (bool success);

  function withdraw(uint256 _value) external returns (bool success);
}
