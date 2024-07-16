pragma solidity ^0.8.0;

import "ds-test/test.sol";

import "../../../contracts/interfaces/IRegistry.sol";
import "../../../contracts/onChainFeeds/UmbrellaFeedsReaderFactory.sol";
import "../../../contracts/interfaces/AggregatorV3Interface.sol";
import "../SignerHelper.sol";

/*
    forge test -vvv --match-contract UmbrellaFeedsReaderFactoryTest
*/
contract UmbrellaFeedsReaderFactoryTest is SignerHelper {
    address public immutable registry;
    UmbrellaFeeds public immutable feeds;
    UmbrellaFeeds public immutable feeds1;
    UmbrellaFeedsReaderFactory public immutable factory;

    bytes32[] priceKeys;
    IUmbrellaFeeds.PriceData[] priceDatas;

    constructor() {
        registry = Mock.create("Registry");

        cheats.mockCall(registry, abi.encodeCall(IRegistry.requireAndGetAddress, ("StakingBank")), abi.encode(bank));
        feeds = new UmbrellaFeeds(IRegistry(registry), 2, 8);
        feeds1 = new UmbrellaFeeds(IRegistry(registry), 2, 8);

        factory = new UmbrellaFeedsReaderFactory(IRegistry(registry));

        priceKeys.push(keccak256(abi.encodePacked("UMB-USD")));
        priceDatas.push(IUmbrellaFeeds.PriceData(0, 86400, 1683410179, 1409031));
        feeds1.update(priceKeys, priceDatas, _signData(2, feeds1, priceKeys, priceDatas));


        priceKeys.push(keccak256(abi.encodePacked("ARB-USD")));
        priceDatas.push(IUmbrellaFeeds.PriceData(0, 86400, 1683410179, 124760000));
        feeds.update(priceKeys, priceDatas, _signData(2, feeds, priceKeys, priceDatas));
    }

    /*
    forge test -vvv --match-test test_factory_deploy
    */
    function test_factory_deploy() public {
        cheats.mockCall(registry, abi.encodeCall(IRegistry.getAddressByString, (feeds.NAME())), abi.encode(address(feeds)));
        UmbrellaFeedsReader reader = factory.deploy("UMB-USD");

        assertEq(reader.decimals(), feeds.DECIMALS());
        assertEq(reader.description(), "UMB-USD");
        assertEq(reader.KEY(), keccak256(abi.encodePacked("UMB-USD")));

        uint256 gasStart = gasleft();
        (,int256 answer,,uint256 updatedAt,) = reader.latestRoundData();
        uint256 gasUsed = gasStart - gasleft();

        emit log_named_uint("gas used to read price", gasUsed);

        assertEq(uint256(answer), priceDatas[0].price, "got price");
        assertEq(updatedAt, priceDatas[0].timestamp, "got timestamp");
    }

    /*
    forge test -vvv --match-test test_factory_deploy_whenDuplicated
    */
    function test_factory_deploy_whenDuplicated() public {
        cheats.mockCall(registry, abi.encodeCall(IRegistry.getAddressByString, (feeds.NAME())), abi.encode(address(feeds)));
        UmbrellaFeedsReader reader = factory.deploy("UMB-USD");

        assertEq(address(factory.deploy("UMB-USD")), address(reader), "returns already deployed instance");
        assertEq(address(factory.deployed("UMB-USD")), address(reader));
    }

    /*
    forge test -vvv --match-test test_UmbrellaFeedsReader_latestRoundData
    */
    function test_UmbrellaFeedsReader_latestRoundData() public {
        cheats.mockCall(registry, abi.encodeCall(IRegistry.getAddressByString, (feeds.NAME())), abi.encode(address(feeds)));
        UmbrellaFeedsReader reader = factory.deploy("UMB-USD");

        (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = AggregatorV3Interface(address(reader)).latestRoundData();

        IUmbrellaFeeds.PriceData memory data = reader.getPriceData();

        emit log_named_int("answer", answer);

        assertEq(roundId, 0, "expect roundId to be 0 - not in use");
        assertEq(answer, 1409031, "expect to return price via AggregatorV3Interface");
        assertEq(startedAt, 0, "expect startedAt to be 0 - not in use");
        assertEq(updatedAt, 1683410179, "expect to return price via AggregatorV3Interface");
        assertEq(answeredInRound, 0, "expect answeredInRound to be 0 - not in use");

        assertEq(uint256(data.price), uint256(answer), "price and data must match");
        assertEq(data.timestamp, updatedAt, "timestamp and updatedAt must match");
    }

    /*
    forge test -vvv --match-test test_UmbrellaFeedsReader_latestRoundData_failWhenNoPriceAndNoFallback
    */
    function test_UmbrellaFeedsReader_latestRoundData_failWhenNoPriceAndNoFallback() public {
        cheats.mockCall(registry, abi.encodeCall(IRegistry.getAddressByString, (feeds.NAME())), abi.encode(address(feeds)));
        UmbrellaFeedsReader reader = factory.deploy("UMB-USD");

        // mock destroyed contract
        cheats.mockCall(address(feeds), abi.encodeCall(IUmbrellaFeeds.prices, (priceKeys[0])), "");

        cheats.expectRevert(UmbrellaFeeds.FeedNotExist.selector);
        (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = AggregatorV3Interface(address(reader)).latestRoundData();

        // no revert
        reader.getPriceDataRaw();
    }

    /*
    forge test -vvv --match-test test_UmbrellaFeedsReader_getPrice_failWhenNoPriceAndNoFallback
    */
    function test_UmbrellaFeedsReader_getPrice_failWhenNoPriceAndNoFallback() public {
        cheats.mockCall(registry, abi.encodeCall(IRegistry.getAddressByString, (feeds.NAME())), abi.encode(address(feeds)));
        UmbrellaFeedsReader reader = factory.deploy("UMB-USD");

        // mock destroyed contract
        cheats.mockCall(address(feeds), abi.encodeCall(IUmbrellaFeeds.prices, (priceKeys[0])), "");

        cheats.expectRevert(UmbrellaFeeds.FeedNotExist.selector);
        reader.getPriceData();
        // no revert
        reader.getPriceDataRaw();
    }
}
