pragma solidity ^0.8.0;

import "ds-test/test.sol";
import {SignerHelper, Mock} from "../../SignerHelper.sol";

import {IRegistry} from "../../../../contracts/interfaces/IRegistry.sol";
import {UmbrellaFeeds, IUmbrellaFeeds} from "../../../../contracts/onChainFeeds/zk-link/UmbrellaFeeds.sol";

/*
    forge test -vv --match-contract UmbrellaFeedsDestroyTest
*/
contract UmbrellaFeedsDestroyZkLinkTest is SignerHelper {
    address public immutable registry;
    UmbrellaFeeds public immutable feeds;

    bytes32[] priceKeys;
    UmbrellaFeeds.PriceData[] priceDatas;

    constructor() {
        registry = Mock.create("Registry");

        cheats.mockCall(registry, abi.encodeCall(IRegistry.requireAndGetAddress, ("StakingBank")), abi.encode(bank));
        feeds = new UmbrellaFeeds(IRegistry(registry), 2, 8);

        priceKeys.push(keccak256(abi.encodePacked("UMB-USD")));
        priceDatas.push(IUmbrellaFeeds.PriceData(0, 86400, 1683410179, 1409031));
    }

    function setUp() public {
        _executeUpdate(feeds);

        UmbrellaFeeds.PriceData memory data = feeds.getPriceData(priceKeys[0]);
        assertGt(data.timestamp, 0);

        cheats.mockCall(registry, abi.encodeCall(IRegistry.getAddressByString, (feeds.NAME())), abi.encode(address(1)));
        feeds.destroy("UMB-USD");
    }

    /*
    forge test -vvv --match-test test_UmbrellaFeeds_destroy_ok
    */
    function test_UmbrellaFeeds_destroy_ok() public {
        (bool success,) = address(feeds).staticcall(abi.encodeWithSelector(UmbrellaFeeds.getPriceData.selector, abi.encodePacked(priceKeys[0])));
        assertTrue(!success, "expect call to fail");
        assertTrue(feeds.disabled(), "expect to be disabled");
    }

    function _executeUpdate(UmbrellaFeeds _feeds) internal {
        UmbrellaFeeds.Signature[] memory signatures = _signData(2, _feeds, priceKeys, priceDatas);
        _feeds.update(priceKeys, priceDatas, signatures);
    }
}
