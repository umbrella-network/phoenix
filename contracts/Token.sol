// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./StakingBank.sol";

contract Token is ERC20 {
  constructor(
    string memory _name,
    string memory _symbol,
    uint256 _initialSupply) public ERC20(_name, _symbol) {
    _mint(msg.sender, _initialSupply);
  }

  function mint(address recipient, uint256 amount) external {
    _mint(recipient, amount);
  }

  function mintAndStake(address recipient, uint256 amount, StakingBank bank) external {
    _mint(recipient, amount);
    _approve(recipient, address(bank), amount);
    bytes memory b;
    bank.receiveApproval(recipient, amount, b);
  }

  function burn(address recipient) external {
    _burn(recipient, balanceOf(recipient));
  }
}
