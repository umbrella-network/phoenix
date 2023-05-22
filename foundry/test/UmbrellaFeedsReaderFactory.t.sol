pragma solidity ^0.8.0;

import "ds-test/test.sol";

import "../../contracts/StakingBankState.sol";
import "../lib/CheatCodes.sol";
import "../lib/Mock.sol";
import "../../contracts/onChainFeeds/UmbrellaFeeds.sol";
import "../../contracts/onChainFeeds/UmbrellaFeedsReaderFactory.sol";
import "../../contracts/interfaces/AggregatorV3Interface.sol";

/*
    forge test -vvv --match-contract UmbrellaFeedsReaderFactoryTest
*/
contract UmbrellaFeedsReaderFactoryTest is DSTest {
    address public immutable registry;
    address public immutable bank;
    UmbrellaFeeds public immutable feeds;
    UmbrellaFeedsReaderFactory public immutable factory;

    CheatCodes constant cheats = CheatCodes(HEVM_ADDRESS);

    bytes32[] priceKeys;
    IUmbrellaFeeds.PriceData[] priceDatas;
    IUmbrellaFeeds.Signature[] signatures;

    constructor() {
        registry = Mock.create("Registry");
        bank = Mock.create("StakingBank");

        cheats.mockCall(registry, abi.encodeCall(Registry.requireAndGetAddress, ("StakingBank")), abi.encode(bank));
        feeds = new UmbrellaFeeds(IRegistry(registry), 2, 8);

        factory = new UmbrellaFeedsReaderFactory(IRegistry(registry));

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

        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (0xDc3eBc37DA53A644D67E5E3b5BA4EEF88D969d5C)), abi.encode(uint256(1e18)));
        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (0x998cb7821e605cC16b6174e7C50E19ADb2Dd2fB0)), abi.encode(uint256(1e18)));

        feeds.update(priceKeys, priceDatas, signatures);
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
