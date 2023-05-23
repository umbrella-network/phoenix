pragma solidity ^0.8.0;

import "ds-test/test.sol";

import "../../contracts/onChainFeeds/UmbrellaFeedsReaderFactory.sol";
import "../../contracts/interfaces/AggregatorV3Interface.sol";
import "./SignerHelper.sol";

/*
    forge test -vvv --match-contract UmbrellaFeedsReaderFactoryTest
*/
contract UmbrellaFeedsReaderFactoryTest is SignerHelper {
    address public immutable registry;
    UmbrellaFeeds public immutable feeds;
    UmbrellaFeedsReaderFactory public immutable factory;

    bytes32[] priceKeys;
    IUmbrellaFeeds.PriceData[] priceDatas;

    constructor() {
        registry = Mock.create("Registry");

        cheats.mockCall(registry, abi.encodeCall(Registry.requireAndGetAddress, ("StakingBank")), abi.encode(bank));
        feeds = new UmbrellaFeeds(IRegistry(registry), 2, 8);

        factory = new UmbrellaFeedsReaderFactory(IRegistry(registry));

        priceKeys.push(keccak256(abi.encodePacked("UMB-USD")));
        priceKeys.push(keccak256(abi.encodePacked("ARB-USD")));

        priceDatas.push(IUmbrellaFeeds.PriceData(0, 86400, 1683410179, 1409031));
        priceDatas.push(IUmbrellaFeeds.PriceData(0, 86400, 1683410179, 124760000));

        feeds.update(priceKeys, priceDatas, _signData(feeds, priceKeys, priceDatas));
    }

    function test_factory_deploy() public {
        cheats.mockCall(registry, abi.encodeCall(Registry.getAddressByString, (feeds.NAME())), abi.encode(address(feeds)));
        UmbrellaFeedsReader reader = factory.deploy("UMB-USD");

        assertEq(reader.decimals(), feeds.DECIMALS());
        assertEq(reader.description(), "UMB-USD");
        assertEq(reader.KEY(), keccak256(abi.encodePacked("UMB-USD")));

        uint256 gasStart = gasleft();
        (,int256 answer,,uint256 updatedAt,) = reader.latestRoundData();
        uint256 gasUsed = gasStart - gasleft();

        emit log_named_uint("gas used to read price:", gasUsed);

        assertEq(uint256(answer), priceDatas[0].price);
        assertEq(updatedAt, priceDatas[0].timestamp);
    }

    function test_factory_deploy_whenDuplicated() public {
        cheats.mockCall(registry, abi.encodeCall(Registry.getAddressByString, (feeds.NAME())), abi.encode(address(feeds)));
        UmbrellaFeedsReader reader = factory.deploy("UMB-USD");

        assertEq(address(factory.deploy("UMB-USD")), address(reader), "returns already deployed instance");
        assertEq(address(factory.deployed("UMB-USD")), address(reader));
    }

    function test_UmbrellaFeedsReader_latestRoundData() public {
        cheats.mockCall(registry, abi.encodeCall(Registry.getAddressByString, (feeds.NAME())), abi.encode(address(feeds)));
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
}
