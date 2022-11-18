pragma solidity ^0.8.0;

import "ds-test/test.sol";

import "../../contracts/StakingBankState.sol";
import "../lib/CheatCodes.sol";
import "../lib/Mock.sol";

contract StakingBankStateTest is DSTest {
    Registry public immutable registry;
    StakingBankState public bank;

    CheatCodes constant cheats = CheatCodes(HEVM_ADDRESS);

    event ValidatorBalanceUpdate(address indexed validator, uint256 balance);
    event TotalSupply(uint256 total);

    constructor() {
        registry = new Registry();
    }

    function setUp() public {
        bank = new StakingBankState(registry);
    }

    function test_setBalances() public {
        address[] memory validators = new address[](1);
        uint256[] memory balances = new uint256[](1);
        validators[0] = address(0x2fFd013AaA7B5a7DA93336C2251075202b33FB2B);
        balances[0] = 1;
        uint256 totalSupply = 3210;

        cheats.expectEmit(true, true, true, true);
        emit ValidatorBalanceUpdate(validators[0], balances[0]);
        cheats.expectEmit(true, true, true, true);
        emit TotalSupply(totalSupply);

        bank.setBalances(validators, balances, totalSupply);

        assertEq(bank.totalSupply(), totalSupply);
        assertEq(bank.balanceOf(validators[0]), balances[0]);
    }

    function test_setBalances_throwsWhenNotOwner() public {
        address[] memory validators = new address[](1);
        uint256[] memory balances = new uint256[](1);

        cheats.prank(address(bank));

        cheats.expectRevert("Ownable: caller is not the owner");
        bank.setBalances(validators, balances, 1);
    }

    function test_setBalances_throwsWhenArraysNotMatch() public {
        address[] memory validators = new address[](1);
        uint256[] memory balances = new uint256[](2);

        cheats.expectRevert(StakingBankState.ArrayLengthError.selector);
        bank.setBalances(validators, balances, 1);
    }

    function test_setBalances_throwsWhenInvalidTotal() public {
        address[] memory validators = new address[](1);
        uint256[] memory balances = new uint256[](1);
        validators[0] = address(0x2fFd013AaA7B5a7DA93336C2251075202b33FB2B);
        balances[0] = 2;
        uint256 totalSupply = 1;

        cheats.expectRevert(StakingBankState.InvalidTotalSupply.selector);
        bank.setBalances(validators, balances, totalSupply);
    }

    function test_setTotalSupply() public {
        uint256 totalSupply = 123;

        cheats.expectEmit(true, true, true, true);
        emit TotalSupply(totalSupply);

        bank.setTotalSupply(totalSupply);
        assertEq(bank.totalSupply(), totalSupply);
    }

    function test_setTotalSupply_throwsWhenNotOwner() public {
        cheats.prank(address(bank));

        cheats.expectRevert("Ownable: caller is not the owner");
        bank.setTotalSupply(123);
    }

    function test_setTotalSupply_throwsWhenNoChangeToState() public {
        bank.setTotalSupply(123);

        cheats.expectRevert(StakingBankState.NoChangeToState.selector);
        bank.setTotalSupply(123);
    }
}
