pragma solidity ^0.8.0;

import "ds-test/test.sol";

import "./SignerHelper.sol";

/*
    forge test -vvv --match-contract UmbrellaFeedsTest
*/
contract UmbrellaFeedsTest is SignerHelper {
    address public immutable registry;
    UmbrellaFeeds public immutable feeds;
    UmbrellaFeeds public immutable feeds1;
    UmbrellaFeeds public immutable feeds6;

    bytes32[] priceKeys;
    UmbrellaFeeds.PriceData[] priceDatas;

    constructor() {
        registry = Mock.create("Registry");

        cheats.mockCall(registry, abi.encodeCall(Registry.requireAndGetAddress, ("StakingBank")), abi.encode(bank));
        feeds = new UmbrellaFeeds(IRegistry(registry), 2, 8);
        feeds1 = new UmbrellaFeeds(IRegistry(registry), 1, 8);
        feeds6 = new UmbrellaFeeds(IRegistry(registry), 6, 8);

        priceKeys.push(keccak256(abi.encodePacked("UMB-USD")));
        priceKeys.push(keccak256(abi.encodePacked("ARB-USD")));

        priceDatas.push(IUmbrellaFeeds.PriceData(0, 86400, 1683410179, 1409031));
        priceDatas.push(IUmbrellaFeeds.PriceData(0, 86400, 1683410179, 124760000));
    }

    function test_UmbrellaFeeds_getPrice_failWhenNoPriceAndNoFallback() public {
        cheats.mockCall(registry, abi.encodeCall(Registry.getAddressByString, (feeds.NAME())), abi.encode(address(feeds)));

        cheats.expectRevert(UmbrellaFeeds.FeedNotExist.selector);
        feeds.getPriceData(bytes32(0));
    }

    function test_UmbrellaFeeds_getPrice_failWhenNoPriceWithFallback() public {
        cheats.mockCall(registry, abi.encodeCall(Registry.getAddressByString, (feeds.NAME())), abi.encode(address(feeds1)));

        cheats.expectRevert(UmbrellaFeeds.FeedNotExist.selector);
        feeds.getPriceData(bytes32(0));
    }

    /*
    forge test -vvv --match-test test_UmbrellaFeeds_debug
    */
    function test_UmbrellaFeeds_debug() public {
        bytes32[] memory keys = new bytes32[](1);
        IUmbrellaFeeds.PriceData[] memory datas = new IUmbrellaFeeds.PriceData[](1);
        IUmbrellaFeeds.PriceData[] memory datas2 = new IUmbrellaFeeds.PriceData[](1);

        keys[0] = keccak256(abi.encodePacked("UMB-USD"));
        datas[0] = IUmbrellaFeeds.PriceData(0,86400,1683651196,1195497);

        IUmbrellaFeeds.Signature[] memory sigs = _signData(2, feeds, keys, datas);
        IUmbrellaFeeds.Signature[] memory sigs1 = _signData(1, feeds1, keys, datas);
        IUmbrellaFeeds.Signature[] memory sigs6 = _signData(6, feeds6, keys, datas);

        uint256 gasStart = gasleft();
        feeds.update(keys, datas, sigs);
        uint256 gasUsed = gasStart - gasleft();

        emit log_named_uint("gas used to update with 2 signatures (initial):", gasUsed);
        assertEq(gasUsed, 41279);

        datas2[0] = IUmbrellaFeeds.PriceData(0, datas[0].heartbeat, datas[0].timestamp + 2, datas[0].price + 10e8);
        sigs = _signData(2, feeds, keys, datas2);

        gasStart = gasleft();
        feeds.update(keys, datas2, sigs);
        gasUsed = gasStart - gasleft();

        emit log_named_uint("gas used to update with 2 signatures (#2):", gasUsed);
        assertEq(gasUsed, 16879);

        gasStart = gasleft();
        feeds1.update(keys, datas, sigs1);
        gasUsed = gasStart - gasleft();

        emit log_named_uint("gas used to update with 1 signature (initial):", gasUsed);
        assertEq(gasUsed, 33667);

        gasStart = gasleft();
        feeds6.update(keys, datas, sigs6);
        gasUsed = gasStart - gasleft();

        emit log_named_uint("gas used to update with 6 signature (initial):", gasUsed);
        assertEq(gasUsed, 59256);

        sigs6 = _signData(6, feeds6, keys, datas2);

        gasStart = gasleft();
        feeds6.update(keys, datas2, sigs6);
        gasUsed = gasStart - gasleft();

        emit log_named_uint("gas used to update with 6 signature (#2):", gasUsed);
        assertEq(gasUsed, 37427);

        gasStart = gasleft();
        IUmbrellaFeeds.PriceData memory result = feeds.getPriceData(keys[0]);
        gasUsed = gasStart - gasleft();

        emit log_named_uint("gas used to read price directly:", gasUsed);
        emit log_named_uint("result:", result.price);
        assertEq(gasUsed, 1951);
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
        _executeUpdate(feeds1);

        UmbrellaFeeds.PriceData memory expectedData = priceDatas[0];

        cheats.mockCall(registry, abi.encodeCall(Registry.getAddressByString, (feeds.NAME())), abi.encode(address(feeds1)));
        UmbrellaFeeds.PriceData memory data = feeds.getPriceData(priceKeys[0]);

        assertEq(data.price, expectedData.price);
    }

    /*
    forge test -vv --match-test test_UmbrellaFeeds_getPrice_withFallbackAddress0
    */
    function test_UmbrellaFeeds_getPrice_withFallbackAddress0() public {
        _executeUpdate(feeds1);

        UmbrellaFeeds.PriceData memory expectedData = priceDatas[0];

        cheats.mockCall(registry, abi.encodeCall(Registry.getAddressByString, (feeds.NAME())), abi.encode(address(0)));

        cheats.expectRevert();
        UmbrellaFeeds.PriceData memory data = feeds.getPriceData(priceKeys[0]);
    }

    function test_UmbrellaFeeds_update_ignoringOtherSignatures() public {
        UmbrellaFeeds.Signature[] memory signatures = _signData(2, feeds, priceKeys, priceDatas);
        UmbrellaFeeds.Signature[] memory moreSignatures = new UmbrellaFeeds.Signature[](3);
        (moreSignatures[0], moreSignatures[1]) = (signatures[0], signatures[1]);
        // third one is empty, but ignored

        feeds.update(priceKeys, priceDatas, moreSignatures);
    }

    function test_UmbrellaFeeds_update_failWhenWantToReuseSignatureInOtherContract() public {
        UmbrellaFeeds.Signature[] memory signatures = _signData(2, feeds, priceKeys, priceDatas);

        // pass
        feeds.update(priceKeys, priceDatas, signatures);

        cheats.expectRevert(UmbrellaFeeds.InvalidSigner.selector);
        // fail
        feeds1.update(priceKeys, priceDatas, signatures);
    }

    function test_UmbrellaFeeds_update_failWhenSignatureUsedAgain() public {
        UmbrellaFeeds.Signature[] memory signatures = _signData(2, feeds, priceKeys, priceDatas);

        // pass
        feeds.update(priceKeys, priceDatas, signatures);

        cheats.expectRevert(UmbrellaFeeds.OldData.selector);
        feeds.update(priceKeys, priceDatas, signatures);
    }

    function test_UmbrellaFeeds_update_failWhenNotEnoughSignatures() public {
        UmbrellaFeeds.Signature[] memory oneSignature = new UmbrellaFeeds.Signature[](1);

        cheats.expectRevert(UmbrellaFeeds.NotEnoughSignatures.selector);
        feeds.update(priceKeys, priceDatas, oneSignature);
    }

    /*
    forge test -vvv --match-test test_UmbrellaFeeds_update_failWhenInvalidSigner
    */
    function test_UmbrellaFeeds_update_failWhenInvalidSigner() public {
        UmbrellaFeeds.Signature[] memory signatures = _invalidSignData(2, feeds, priceKeys, priceDatas);
        cheats.expectRevert(UmbrellaFeeds.InvalidSigner.selector);

        feeds.update(priceKeys, priceDatas, signatures);
    }

    function test_UmbrellaFeeds_update_failWhenSignaturesNotInOrder() public {
        UmbrellaFeeds.Signature[] memory signaturesNotOrdered = _signData(2, feeds, priceKeys, priceDatas);
        (signaturesNotOrdered[1], signaturesNotOrdered[0]) = (signaturesNotOrdered[0], signaturesNotOrdered[1]);

        cheats.expectRevert(UmbrellaFeeds.SignaturesOutOfOrder.selector);
        feeds.update(priceKeys, priceDatas, signaturesNotOrdered);
    }

    function test_UmbrellaFeeds_update_failNotEnoughSignatures() public {
        UmbrellaFeeds.Signature[] memory signatures = _signData(2, feeds, priceKeys, priceDatas);
        UmbrellaFeeds.Signature[] memory onesignature = new UmbrellaFeeds.Signature[](1);
        onesignature[0] = signatures[0];

        cheats.expectRevert(UmbrellaFeeds.NotEnoughSignatures.selector);
        feeds.update(priceKeys, priceDatas, onesignature);
    }

    /*
    forge test -vvv --match-test test_UmbrellaFeeds_reset
    */
    function test_UmbrellaFeeds_reset() public {
        feeds.update(priceKeys, priceDatas, _signData(2, feeds, priceKeys, priceDatas));

        assert(feeds.prices(priceKeys[0]).price != 0);
        assert(feeds.prices(priceKeys[1]).price != 0);

        bytes32[] memory toRemove = new bytes32[](1);
        toRemove[0] = priceKeys[1];

        UmbrellaFeeds.Signature[] memory signatures = _signReset(2, feeds, toRemove);

        feeds.reset(toRemove, signatures);

        assert(feeds.prices(priceKeys[0]).price != 0);
        assert(feeds.prices(priceKeys[1]).price == 0);
    }

    function test_UmbrellaFeeds_failWhenWantToUpdateResetedData() public {
        UmbrellaFeeds.Signature[] memory oldSignatures = _signData(2, feeds, priceKeys, priceDatas);
        feeds.update(priceKeys, priceDatas, oldSignatures);

        UmbrellaFeeds.Signature[] memory signatures = _signReset(2, feeds, priceKeys);

        feeds.reset(priceKeys, signatures);

        cheats.expectRevert(UmbrellaFeeds.DataReset.selector);
        feeds.update(priceKeys, priceDatas, oldSignatures);
    }

    function _executeUpdate(UmbrellaFeeds _feeds) internal {
        UmbrellaFeeds.Signature[] memory signatures = _signData(2, _feeds, priceKeys, priceDatas);
        _feeds.update(priceKeys, priceDatas, signatures);
    }
}
