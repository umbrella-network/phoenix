// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IStakingBank.sol";

// please remember this is our dummy token!
// it will be replaced by proper DPoS solution in future
contract Token is ERC20 {
    constructor(
        string memory _name,
        string memory _symbol) ERC20(_name, _symbol) {
    }

    function mint(address _holder, uint256 _amount) external {
        _mint(_holder, _amount);
    }

    function mintApproveAndStake(IStakingBank _stakingBank, address _holder, uint256 _amount) external {
        _mint(_holder, _amount);
        _approve(_holder, address(_stakingBank), _amount);
        _stakingBank.receiveApproval(_holder);
    }

    function getName() external pure returns (bytes32) {
        return "UMB";
    }
}
