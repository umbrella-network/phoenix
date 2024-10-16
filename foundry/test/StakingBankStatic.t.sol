pragma solidity ^0.8.0;

import "ds-test/test.sol";
import "../lib/CheatCodes.sol";
import "../../contracts/stakingBankStatic/StakingBankStaticProd.sol";

/*
    forge test -vv --match-contract StaticBankStaticTest
*/
contract StaticBankStaticTest is DSTest {
    StakingBankStaticProd public immutable bank;

    CheatCodes constant cheats = CheatCodes(HEVM_ADDRESS);

    mapping (address => string) locations;

    constructor() {
        bank = new StakingBankStaticProd(15);

        locations[address(0x977Ba523420110e230643B772Fe9cF955e11dA7B)] = "https://validator.umb.network";
        locations[address(0xe2422b23e52bc13ebA04d7FbB9F332Deb43360fB)] = "https://validator2.umb.network";
        locations[address(0x42e210b110c6aa49CdfA7ceF1444Aa4719653111)] = "https://umb.anorak.technology";
        locations[address(0x57A51D5BDcE188c2295fCA3b4687475a54E65A02)] = "http://5.161.78.230:3000";
        locations[address(0x8bF9661F1b247522C75DD0FE84355aD2EfF27144)] = "https://umb.hashkey.cloud";
        locations[address(0x501731c6a69803a53Ec6c3e12f293c247cE1092B)] = "https://umbrella.validator.infstones.io";
        locations[address(0x281754Ab58391A478B7aA4E7f39991CfB41118c4)] = "http://umbrella.staking4all.org:3000";
        locations[address(0x2F85824B2B38F179E451988670935d315b5b9692)] = "https://umb-api.staking.rocks";
        locations[address(0xD56C6A4f64E0bD70260472d1DB6Cf5825858CB0d)] = "https://umb.vtabsolutions.com:3030";
        locations[address(0x93FdcAB283b0BcAc48157590af482E1CFd6af6aC)] = "https://umbrella.crazywhale.es";
        locations[address(0xCd733E06B06083d52fC5867E8E3432aA5c103A38)] = "https://umbrella-node.gateomega.com";
        locations[address(0x57F404aD75e371c1A539589C1eFCA12e0C6980AD)] = "https://umbrella.artemahr.tech";
        locations[address(0xA7241994267682de4dE7Ef62f52dc2C783d1784B)] = "https://rpc.urbanhq.net";
        locations[address(0x6eEd457C20603EDAE50C3A112CAA1a9425321bD0)] = "https://umbrella-node.ankastake.com";
        locations[address(0xC5a7650c2725a7B6A39f15cb9FbffC7af357AFeb)] = "https://umbrella.tchambrella.com";
    }

    function test_constructor() public {
        cheats.expectRevert();
        new StakingBankStaticProd(18);

        cheats.expectRevert();
        new StakingBankStaticProd(100);
    }

    function test_addresses() public {
        address[] memory list = bank.getAddresses();
        assertEq(list.length, bank.getNumberOfValidators());

        for (uint256 i; i < list.length; i++) {
            assertTrue(list[i] != address(0));
        }
    }

    function test_getBalances() public {
        uint256[] memory list = bank.getBalances();
        assertEq(list.length, bank.getNumberOfValidators());

        for (uint256 i; i < list.length; i++) {
            assertEq(list[i], 1e18);
        }
    }

    function test_validators() public {
        address[] memory list = bank.getAddresses();

        for (uint256 i; i < list.length; i++) {
            (address id, string memory location) = bank.validators(list[i]);

            assertEq(id, list[i]);
            assertTrue(bytes(location).length != 0);
        }
    }

    function test_totalSupply() public {
        assertEq(bank.totalSupply(), bank.getNumberOfValidators() * 1e18);
    }

    function test_balanceOf() public {
        address[] memory validators = bank.getAddresses();

        for (uint256 i; i < validators.length; i++) {
            uint256 balanceOf = bank.balanceOf(validators[i]);
            uint256 balances = bank.balances(validators[i]);

            assertEq(balanceOf, balances);
            assertTrue(balanceOf != 0);
        }
    }

    function test_balanceMatch() public {
        address[] memory validators = bank.getAddresses();
        uint256 total = bank.totalSupply();
        uint256 sum1;
        uint256 sum2;

        for (uint256 i; i < validators.length; i++) {
            sum1 += bank.balanceOf(validators[i]);
            sum2 += bank.balances(validators[i]);
        }

        assertEq(total, sum1);
        assertEq(total, sum2);
    }

    function test_balanceOf_invalid() public {
        assertEq(bank.balanceOf(address(this)), 0);
        assertEq(bank.balances(address(this)), 0);
    }

    function test_locations() public {
        address[] memory validators = bank.getAddresses();

        for (uint256 i; i < validators.length; i++) {
            (, string memory location) = bank.validators(validators[i]);
            string memory expectedLocation = locations[validators[i]];

            assertEq(expectedLocation, location);
        }
    }
}
