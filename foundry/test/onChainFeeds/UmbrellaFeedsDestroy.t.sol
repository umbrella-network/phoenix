pragma solidity 0.8.13;

import "ds-test/test.sol";

import "../../../contracts/interfaces/IRegistry.sol";
import "../SignerHelper.sol";

/*
    forge test -vv --match-contract UmbrellaFeedsDestroyTest
*/
contract UmbrellaFeedsDestroyTest is SignerHelper {
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
    }

    /*
    forge test -vvv --match-test test_UmbrellaFeeds_destroy_ok
    */
    function test_UmbrellaFeeds_destroy_ok() public {
        feeds.destroy("UMB-USD");

        cheats.warp(block.timestamp + 1);
        cheats.roll(block.number + 1);
        // foundry can not deal with selfdestruct
        // if we not revert, then this tess pass
        
//        (bool success, bytes memory data) = address(feeds).staticcall(abi.encodeWithSelector(UmbrellaFeeds.getPriceData.selector, priceKeys[0]));
//        assertTrue(success);
//        emit log_named_bytes("data after destroy", data);
//        assertEq(data.length, 0, "expect no data");
    }

    function _executeUpdate(UmbrellaFeeds _feeds) internal {
        UmbrellaFeeds.Signature[] memory signatures = _signData(2, _feeds, priceKeys, priceDatas);
        _feeds.update(priceKeys, priceDatas, signatures);
    }
}
