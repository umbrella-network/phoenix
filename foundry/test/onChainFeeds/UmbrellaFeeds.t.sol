pragma solidity ^0.8.0;

import "ds-test/test.sol";

import "../../../contracts/interfaces/IRegistry.sol";
import "../SignerHelper.sol";

/*
    forge test -vvv --match-contract UmbrellaFeedsTest
*/
contract UmbrellaFeedsTest is SignerHelper {
    address public immutable registry;
    UmbrellaFeeds public immutable feeds;
    UmbrellaFeeds public immutable feeds1;
    UmbrellaFeeds public immutable feeds6;

    bytes32[] priceKeys;
    IUmbrellaFeeds.PriceData[] priceDatas;

    constructor() {
        registry = Mock.create("Registry");

        cheats.mockCall(registry, abi.encodeCall(IRegistry.requireAndGetAddress, ("StakingBank")), abi.encode(bank));
        feeds = new UmbrellaFeeds(IRegistry(registry), 10, 8);
        feeds1 = new UmbrellaFeeds(IRegistry(registry), 1, 8);
        feeds6 = new UmbrellaFeeds(IRegistry(registry), 6, 8);

        priceKeys.push(keccak256(abi.encodePacked("UMB-USD")));
        priceKeys.push(keccak256(abi.encodePacked("ARB-USD")));

        priceDatas.push(IUmbrellaFeeds.PriceData(0, 86400, 1683410179, 1409031));
        priceDatas.push(IUmbrellaFeeds.PriceData(0, 86400, 1683410179, 124760000));
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
        assertEq(gasUsed, 41286);

        datas2[0] = IUmbrellaFeeds.PriceData(0, datas[0].heartbeat, datas[0].timestamp + 2, datas[0].price + 10e8);
        sigs = _signData(2, feeds, keys, datas2);

        gasStart = gasleft();
        feeds.update(keys, datas2, sigs);
        gasUsed = gasStart - gasleft();

        emit log_named_uint("gas used to update with 2 signatures (#2):", gasUsed);
        assertEq(gasUsed, 16866);

        gasStart = gasleft();
        feeds1.update(keys, datas, sigs1);
        gasUsed = gasStart - gasleft();

        emit log_named_uint("gas used to update with 1 signature (initial):", gasUsed);
        assertEq(gasUsed, 33496);

        gasStart = gasleft();
        feeds6.update(keys, datas, sigs6);
        gasUsed = gasStart - gasleft();

        emit log_named_uint("gas used to update with 6 signature (initial):", gasUsed);
        assertEq(gasUsed, 59855);

        sigs6 = _signData(6, feeds6, keys, datas2);

        gasStart = gasleft();
        feeds6.update(keys, datas2, sigs6);
        gasUsed = gasStart - gasleft();

        emit log_named_uint("gas used to update with 6 signature (#2):", gasUsed);
        assertEq(gasUsed, 37986);

        gasStart = gasleft();
        IUmbrellaFeeds.PriceData memory result = feeds.getPriceData(keys[0]);
        gasUsed = gasStart - gasleft();

        emit log_named_uint("gas used to read price directly:", gasUsed);
        emit log_named_uint("result:", result.price);
        assertEq(gasUsed, 1902);
    }

    /*
    forge test -vvv --match-test test_UmbrellaFeeds_getManyPriceDataRaw_whenNoData
    */
    function test_UmbrellaFeeds_getManyPriceDataRaw_whenNoData() public {
        emit log_address(address(feeds));

        cheats.mockCall(registry, abi.encodeCall(IRegistry.getAddress, ("UmbrellaFeeds")), abi.encode(address(feeds)));
        IUmbrellaFeeds.PriceData[] memory data = feeds.getManyPriceDataRaw(priceKeys);

        for (uint256 i; i < data.length; i++) {
            assertEq(data[i].price, 0);
        }
    }

    /*
    forge test -vvv --match-test test_UmbrellaFeeds_destroy_failWhenNoData
    */
    function test_UmbrellaFeeds_destroy_failWhenNoData() public {
        cheats.mockCall(registry, abi.encodeCall(IRegistry.getAddressByString, (feeds.NAME())), abi.encode(address(1)));
        cheats.expectRevert(UmbrellaFeeds.ContractNotInitialised.selector);
        feeds.destroy("no-data");
    }

    /*
    forge test -vvv --match-test test_UmbrellaFeeds_destroy_failWhenContractInUse
    */
    function test_UmbrellaFeeds_destroy_failWhenContractInUse() public {
        cheats.mockCall(registry, abi.encodeCall(IRegistry.getAddressByString, (feeds.NAME())), abi.encode(address(feeds)));

        cheats.expectRevert(UmbrellaFeeds.ContractInUse.selector);
        feeds.destroy("UMB-USD");
    }

    /*
    forge test -vv --match-test test_UmbrellaFeeds_getPrice_withFallbackAddress0
    */
    function test_UmbrellaFeeds_getPrice_withFallbackAddress0() public {
        _executeUpdate(feeds1);

        cheats.mockCall(registry, abi.encodeCall(IRegistry.getAddressByString, (feeds.NAME())), abi.encode(address(0)));

        cheats.expectRevert();
        IUmbrellaFeeds.PriceData memory data = feeds.getPriceData(priceKeys[0]);
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
    forge test -vvv --match-test test_UmbrellaFeeds_update_debug
    */
    function test_UmbrellaFeeds_update_debug() public {
        IUmbrellaFeeds.Signature[] memory signatures = new IUmbrellaFeeds.Signature[](10);

        signatures[0] = IUmbrellaFeeds.Signature({
            v: 28,
            r: 0xe512337433abbd302552e25ba868cc2b09681810a6a9ebb5cd4c5fbe2c474def,
            s: 0x231aceba4434bd69e41e9141ece4a394b54f85021f213cfdfcd28ac00de9a0ca
        });

        signatures[1] = IUmbrellaFeeds.Signature({
            v: 27,
            r: 0x2eef7885c1702f2c38d1f0fe57e4d34886d857ea5aad1572206b02bfa05bfcf7,
            s: 0x270cd953b2bc90a10eae4756309990f1bd5717f7285955019c571067b7288178
        });

        signatures[2] = IUmbrellaFeeds.Signature({
            v: 27,
            r: 0x0327ee934f0e9486ffd916f0034c5e5222743b5dff3009d013d8f341fea22b88,
            s: 0x2b4deeebc754502a03cedb894e472c16a4a81510148f73fe8d33f2b74e4df9d1
        });

        signatures[3] = IUmbrellaFeeds.Signature({
            v: 27,
            r: 0xbf683640f69b2c2a163d7c4a2638b27050de5675dda99fd83477d5ac4ef2da8a,
            s: 0x68fa9135ca7dce71d6c2625ec4d28eb7bbfa0971370c107d8783678829c1de7e
        });

        signatures[4] = IUmbrellaFeeds.Signature({
            v: 27,
            r: 0x819993e74fdfc2299bf78d51ab01a8347047a2cec82eb367c051f3d17cf6d8c4,
            s: 0x32c3e0477e327f12eaf54b53d8e10f004c153381a0a80811e3c6f2684d6b47fa
        });

        signatures[5] = IUmbrellaFeeds.Signature({
            v: 28,
            r: 0x7a853555ab698c0f5c0218c7f5fca28bf44b770b154ae854ccde27e40e83fac5,
            s: 0x42af782ecf3c41f938a5d17fd107ccfb5a1855aebff1e4feea28589e8fe1e79c
        });

        signatures[6] = IUmbrellaFeeds.Signature({
            v: 28,
            r: 0x628efa0b2ce5ae70794afb82ac54043a7082bba2a517ec81370890cb9f093b49,
            s: 0x3e7a85330ca6213fab9bd3e3280a27f31cbdb3b5850f35e5ef1c165a80527049
        });

        signatures[7] = IUmbrellaFeeds.Signature({
            v: 28,
            r: 0x11af62f584eb2dd58cbd8d0bc20d8cd284e30cc064aee3b291d7191c5278456b,
            s: 0x1ec6f08c6daaa46f1bb3bb0151151d09dad7c1f8ada83bb173bc70a4a6b6e8a3
        });

        signatures[8] = IUmbrellaFeeds.Signature({
            v: 27,
            r: 0x5ad59cc8bbee2f095c846070531a12c742114db211ff3a4e25ada7b1d7a2855a,
            s: 0x195ed7283d2b335fd28f97a837a2bfd71c2056e452c7ce4787ced049df300b90
        });

        signatures[9] = IUmbrellaFeeds.Signature({
            v: 27,
            r: 0x8d7ac2702baad2ac4461bc4d22844a2cb59ab5888a508828950b3d2bc4d9c332,
            s: 0x5d1fc44b193775328de796d48ff692f898136d8f6696750978b23336502b4f24
        });

        bytes32[] memory _priceKeys = new bytes32[](2);
        _priceKeys[0] = 0xfcf7d5c535ee681ffc3508e3b33fbac151e7214a2093bea6a6590c80a79d832a;
        _priceKeys[1] = 0x5155aba114340451141129d99ac2d39373f431cb10a92838a10afc22195791dd;

        IUmbrellaFeeds.PriceData[] memory _priceDatas =  new IUmbrellaFeeds.PriceData[](2);
        _priceDatas[0] = IUmbrellaFeeds.PriceData({
            data: 0,
            heartbeat: 86400,
            timestamp: 1725229925,
            price: 853
        });

        _priceDatas[1] = IUmbrellaFeeds.PriceData({
            data: 0,
            heartbeat: 86400,
            timestamp: 1725229925,
            price: 7224606
        });

        emit log_named_bytes("prefix", feeds.ETH_PREFIX());

        feeds.update(_priceKeys, _priceDatas, signatures);
    }

    function _executeUpdate(UmbrellaFeeds _feeds) internal {
        UmbrellaFeeds.Signature[] memory signatures = _signData(2, _feeds, priceKeys, priceDatas);
        _feeds.update(priceKeys, priceDatas, signatures);
    }
}
