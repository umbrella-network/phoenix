pragma solidity ^0.8.0;

import "ds-test/test.sol";

import "../../contracts/StakingBankState.sol";
import "../lib/CheatCodes.sol";
import "../lib/Mock.sol";
import "../../contracts/onChainFeeds/UmbrellaFeeds.sol";

/*
    forge test -vvv --match-contract UmbrellaFeedsTest
*/
contract UmbrellaFeedsTest is DSTest {
    address public immutable registry;
    address public immutable bank;
    UmbrellaFeeds public immutable feeds;
    UmbrellaFeeds public immutable feeds2;

    CheatCodes constant cheats = CheatCodes(HEVM_ADDRESS);

    bytes32[] priceKeys;
    UmbrellaFeeds.PriceData[] priceDatas;
    UmbrellaFeeds.Signature[] signatures;

    constructor() {
        registry = Mock.create("Registry");
        bank = Mock.create("StakingBank");

        cheats.mockCall(registry, abi.encodeCall(Registry.requireAndGetAddress, ("StakingBank")), abi.encode(bank));
        feeds = new UmbrellaFeeds(IRegistry(registry), 2, 8);
        feeds2 = new UmbrellaFeeds(IRegistry(registry), 1, 8);

        priceKeys.push(keccak256(abi.encodePacked("UMB-USD")));
        priceKeys.push(keccak256(abi.encodePacked("ARB-USD")));

        priceDatas.push(IUmbrellaFeeds.PriceData(0, 86400, 1683410179, 1409031));
        priceDatas.push(IUmbrellaFeeds.PriceData(0, 86400, 1683410179, 124760000));

        signatures.push(IUmbrellaFeeds.Signature(
            0x1c,
            0x13e3ac7310359be7661f89fce4c25b727589afeac1c0e5d440d868757fc85ab8,
            0x603f1f2c9e8717fc8ad04bdba857e635105c71551187155a0ca31a9d4bf2c0f1
        ));

        signatures.push(IUmbrellaFeeds.Signature(
            0x1c,
            0x54177611f90f2299ae74d036eb8cf4b0097e950416f0712881fd0814e6082fd9,
            0x70e261aa02b105c4098663e91175d92d7c10b4e69e9d8191593231d1373d2e27
        ));
    }

    function test_UmbrellaFeeds_getPrice_failWhenNoPriceAndNoFallback() public {
        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (0xDc3eBc37DA53A644D67E5E3b5BA4EEF88D969d5C)), abi.encode(uint256(1e18)));
        cheats.mockCall(registry, abi.encodeCall(Registry.getAddressByString, (feeds.NAME())), abi.encode(address(feeds)));

        cheats.expectRevert(UmbrellaFeeds.FeedNotExist.selector);
        feeds.getPriceData(bytes32(0));
    }

    function test_UmbrellaFeeds_getPrice_failWhenNoPriceWithFallback() public {
        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (0xDc3eBc37DA53A644D67E5E3b5BA4EEF88D969d5C)), abi.encode(uint256(1e18)));
        cheats.mockCall(registry, abi.encodeCall(Registry.getAddressByString, (feeds.NAME())), abi.encode(address(feeds2)));

        cheats.expectRevert(UmbrellaFeeds.FeedNotExist.selector);
        feeds.getPriceData(bytes32(0));
    }

    /*
    forge test -vvv --match-test test_UmbrellaFeeds_debug
    */
    function test_UmbrellaFeeds_debug() public {
        bytes32[] memory keys = new bytes32[](1);
        IUmbrellaFeeds.PriceData[] memory datas = new IUmbrellaFeeds.PriceData[](1);
        IUmbrellaFeeds.Signature[] memory sigs = new IUmbrellaFeeds.Signature[](2);

        keys[0] = keccak256(abi.encodePacked("UMB-USD"));
        datas[0] = IUmbrellaFeeds.PriceData(0,86400,1683651196,1195497);
        sigs[1] = IUmbrellaFeeds.Signature(
            0x1b,
            0x66b278a49004d056662efa0255be4a32a2c43c27bfe0359a3e9f67997d316d24,
            0x6381eabd2b3b9fe54f7e4917d32c7b3c47962dc1385f521ea16354cbe579f6e3
        );
        sigs[0] = IUmbrellaFeeds.Signature(
            0x1b,
            0x9a20c0c5aeccd6436e5563faa3a78047a01c2b4d9c7b1e5e12a5bb70445feda1,
            0x3588c203248a9e192ccc2ef9450aed13001661932ff2c3e5816a4849fa95fced
        );

        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (0xDc3eBc37DA53A644D67E5E3b5BA4EEF88D969d5C)), abi.encode(uint256(1e18)));
        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (0x998cb7821e605cC16b6174e7C50E19ADb2Dd2fB0)), abi.encode(uint256(1e18)));

        uint256 gasStart = gasleft();
        feeds.update(keys, datas, sigs);
        uint256 gasUsed = gasStart - gasleft();

        emit log_named_uint("gas used to update with 2 signatures:", gasUsed);

        gasStart = gasleft();
        feeds2.update(keys, datas, sigs);
        gasUsed = gasStart - gasleft();

        emit log_named_uint("gas used to update with 1 signature:", gasUsed);

        gasStart = gasleft();
        IUmbrellaFeeds.PriceData memory result = feeds.getPriceData(keys[0]);
        gasUsed = gasStart - gasleft();

        emit log_named_uint("gas used to read price directly:", gasUsed);
    }

    /*
    forge test -vvv --match-test test_UmbrellaFeeds_getManyPriceDataRaw_whenNoData
    */
    function test_UmbrellaFeeds_getManyPriceDataRaw_whenNoData() public {
        emit log_address(address(feeds));

        cheats.mockCall(registry, abi.encodeCall(Registry.getAddress, ("UmbrellaFeeds")), abi.encode(address(feeds)));
        UmbrellaFeeds.PriceData[] memory data = feeds.getManyPriceDataRaw(priceKeys);

        for (uint256 i; i < data.length; i++) {
            assertEq(data[i].price, 0);
        }
    }

    /*
    forge test -vvv --match-test test_UmbrellaFeeds_getPrice_withFallback
    */
    function test_UmbrellaFeeds_getPrice_withFallback() public {
        _executeUpdate(feeds2);

        UmbrellaFeeds.PriceData memory expectedData = priceDatas[0];

        cheats.mockCall(registry, abi.encodeCall(Registry.getAddressByString, (feeds.NAME())), abi.encode(address(feeds2)));
        UmbrellaFeeds.PriceData memory data = feeds.getPriceData(priceKeys[0]);

        assertEq(data.price, expectedData.price);
    }

    function test_UmbrellaFeeds_update_ignoringOtherSignatures() public {
        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (0xDc3eBc37DA53A644D67E5E3b5BA4EEF88D969d5C)), abi.encode(uint256(1e18)));
        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (0x998cb7821e605cC16b6174e7C50E19ADb2Dd2fB0)), abi.encode(uint256(1e18)));

        UmbrellaFeeds.Signature[] memory moreSignatures = new UmbrellaFeeds.Signature[](3);
        moreSignatures[0] = signatures[0];
        moreSignatures[1] = signatures[1];
        // third one is empty, but ignored

        feeds.update(priceKeys, priceDatas, moreSignatures);
    }

    function test_UmbrellaFeeds_update_failWhenNotEnoughSignatures() public {
        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (0xDc3eBc37DA53A644D67E5E3b5BA4EEF88D969d5C)), abi.encode(uint256(1e18)));
        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (0x998cb7821e605cC16b6174e7C50E19ADb2Dd2fB0)), abi.encode(uint256(0)));

        cheats.expectRevert(UmbrellaFeeds.NotEnoughSignatures.selector);
        feeds.update(priceKeys, priceDatas, signatures);
    }

    function test_UmbrellaFeeds_update_failWhenSignaturesNotInOrder() public {
        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (0xDc3eBc37DA53A644D67E5E3b5BA4EEF88D969d5C)), abi.encode(uint256(1e18)));

        UmbrellaFeeds.Signature[] memory signaturesNotOrdered = new UmbrellaFeeds.Signature[](2);
        signaturesNotOrdered[0] = signatures[1];
        signaturesNotOrdered[1] = signatures[1];

        cheats.expectRevert(UmbrellaFeeds.SignaturesOutOfOrder.selector);
        feeds.update(priceKeys, priceDatas, signaturesNotOrdered);
    }

    function test_UmbrellaFeeds_update_failNotEnoughSignatures() public {
        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (0xDc3eBc37DA53A644D67E5E3b5BA4EEF88D969d5C)), abi.encode(uint256(1e18)));

        UmbrellaFeeds.Signature[] memory onesignature = new UmbrellaFeeds.Signature[](1);
        onesignature[0] = signatures[1];

        cheats.expectRevert(UmbrellaFeeds.NotEnoughSignatures.selector);
        feeds.update(priceKeys, priceDatas, onesignature);
    }

    /*
    forge test -vvv --match-test test_UmbrellaFeeds_reset_failNotEnoughSignatures
    */
//    function test_UmbrellaFeeds_reset() public {
//        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (0xDc3eBc37DA53A644D67E5E3b5BA4EEF88D969d5C)), abi.encode(uint256(1e18)));
//
//        UmbrellaFeeds.Signature[] memory onesignature = new UmbrellaFeeds.Signature[](2);
//        onesignature[0] = signatures[0];
//        onesignature[1] = signatures[1];
//
//        feeds.reset(priceKeys, onesignature);
//    }

    function _executeUpdate(UmbrellaFeeds _feeds) internal {
        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (0xDc3eBc37DA53A644D67E5E3b5BA4EEF88D969d5C)), abi.encode(uint256(1e18)));
        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (0x998cb7821e605cC16b6174e7C50E19ADb2Dd2fB0)), abi.encode(uint256(1e18)));

        _feeds.update(priceKeys, priceDatas, signatures);
    }
}
