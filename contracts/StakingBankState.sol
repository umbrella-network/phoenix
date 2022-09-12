// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IStakingBank.sol";
import "./extensions/Registrable.sol";
import "./Registry.sol";

contract StakingBankState is IStakingBank, Registrable, Ownable {
    uint256 public totalSupply;

    /// validator address => validator balance
    mapping(address => uint256) public balances;

    event ValidatorBalanceUpdate(address indexed validator, uint256 balance);
    event TotalSupply(uint256 total);

    error ArrayLengthError();
    error InvalidTotalSupply();
    error NoChangeToState();
    error NotSupported();

    constructor(IRegistry _contractRegistry) Registrable(_contractRegistry) {
        // no additional configuration needed
    }

    /// @inheritdoc Registrable
    function register() external override {
        // there are no requirements atm
    }

    /// @inheritdoc Registrable
    function unregister() external override {
        // there are no requirements atm
    }

    /// @notice use it to clone validators balances from master chain
    /// @param _totalSupply cloned value from master chain, it can be 0
    function setTotalSupply(uint256 _totalSupply) external onlyOwner {
        if (totalSupply == _totalSupply) revert NoChangeToState();

        _setTotalSupply(_totalSupply);
    }

    /// @notice use it to clone validators balances from master chain
    /// @param _validators array of validator addresses that needs to be updated
    /// @param _balances array of validator _balances that will be set (can be 0s)
    /// @param _totalSupply cloned value from master chain, it can be 0
    function setBalances(address[] calldata _validators, uint256[] calldata _balances, uint256 _totalSupply)
        external
        onlyOwner
    {
        if (_validators.length != _balances.length) revert ArrayLengthError();

        uint256 total;

        for (uint256 i; i < _validators.length;) {
            balances[_validators[i]] = _balances[i];
            emit ValidatorBalanceUpdate(_validators[i], _balances[i]);
            total += _balances[i];

            unchecked {
                i++;
            }
        }

        if (total > _totalSupply) revert InvalidTotalSupply();

        if (totalSupply != _totalSupply) {
            _setTotalSupply(_totalSupply);
        }
    }

    /// @inheritdoc IERC20
    function balanceOf(address _account) external view returns (uint256) {
        return balances[_account];
    }

    function transfer(address, uint256) external pure returns (bool) {
        revert NotSupported();
    }

    function stake(uint256) external pure {
        revert NotSupported();
    }

    function withdraw(uint256) external pure returns (bool) {
        revert NotSupported();
    }

    function exit() external pure returns (bool) {
        revert NotSupported();
    }

    function create(address, string calldata) external pure {
        revert NotSupported();
    }

    function update(address, string calldata) external pure {
        revert NotSupported();
    }

    function remove(address) external pure {
        revert NotSupported();
    }

    function validators(address) external pure returns (address, string memory) {
        revert NotSupported();
    }

    function setMinAmountForStake(uint256) external pure {
        revert NotSupported();
    }

    function approve(address, uint256) external pure returns (bool) {
        revert NotSupported();
    }

    function receiveApproval(address) external pure returns (bool) {
        revert NotSupported();
    }

    function receiveApproval(address, uint256) external pure returns (bool) {
        revert NotSupported();
    }

    function transferFrom(address, address, uint256) public pure virtual override returns (bool) {
        revert NotSupported();
    }

    function allowance(address, address) external pure returns (uint256) {
        revert NotSupported();
    }

    function addresses(uint256) external pure returns (address) {
        revert NotSupported();
    }

    function getNumberOfValidators() external pure returns (uint256) {
        revert NotSupported();
    }

    /// @inheritdoc Registrable
    function getName() external pure override returns (bytes32) {
        return "StakingBank";
    }

    function _setTotalSupply(uint256 _totalSupply) private {
        totalSupply = _totalSupply;
        emit TotalSupply(_totalSupply);
    }
}
