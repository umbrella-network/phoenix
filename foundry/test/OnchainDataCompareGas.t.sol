pragma solidity ^0.8.0;

import "ds-test/test.sol";
import "../lib/CheatCodes.sol";

import "../../contracts/onChainFeeds/UmbrellaFeeds.sol";
import "../../contracts/onChainFeeds/UmbrellaFeedsReaderFactory.sol";
import "../../contracts/interfaces/AggregatorV3Interface.sol";
import "../../contracts/stakingBankStatic/StakingBankStaticLocal.sol";

// NOTE: all gas tests are disabled, atm there is no easy option to exclude them from CI
// to run them, replace `function off_` with `function test_`
contract OnchainDataCompareGasTest is DSTest {
    CheatCodes constant cheats = CheatCodes(HEVM_ADDRESS);

    IRegistry constant REGISTRY = IRegistry(0xc94A585C1bC804C03A864Ee766Dd1B432f73f9A8);
    address constant FEEDS = address(0x656338A8302021d3F5C1a1CcB2FfB3C3E4753331);
    address constant FEEDS_FALLBACK = address(0x2663BFC8D0C833F602F6fF74482C113187cb0e1e);
    bytes32 constant KEY = keccak256(abi.encodePacked("UMB-USD"));

    /*
    forge test -vvv --match-test test_gas_ChainlinkCost --fork-url https://api.avax.network/ext/bc/C/rpc
    */
    function off_gas_ChainlinkCost() public {
        // proxy:
        AggregatorV3Interface aggregator = AggregatorV3Interface(0x0A77230d17318075983913bC2145DB16C7366156);
        // direct:
        // AggregatorV3Interface aggregator = AggregatorV3Interface(0x9450A29eF091B625e976cE66f2A5818e20791999);

        // only proxy allowed to do direct call, unless you whitelisted
        // cheats.prank(0x0A77230d17318075983913bC2145DB16C7366156, 0x0A77230d17318075983913bC2145DB16C7366156);
        uint256 gasLeft = gasleft();
        aggregator.latestRoundData();
        uint chainlinkGas = gasLeft - gasleft();

        emit log_named_uint("chainlink cost", chainlinkGas);
        emit log_named_uint("calculation done on block", block.number);
        emit log_named_uint("calculation done at time", block.timestamp);
    }

    /*
    forge test -vvv --match-test test_gas_UmbrellaFeeds --fork-url https://api.avax-test.network/ext/bc/C/rpc
    */
    function off_gas_UmbrellaFeeds() public {
        // NOTICE: to see real gas cost uncomment only one test case at a time
        emit log("getPrice()");
        _umbrellaFeeds_gasCost(FEEDS, abi.encodeWithSignature("getPrice(bytes32)", KEY));

        // emit log("getPriceTimestamp()");
        // _umbrellaFeeds_gasCost(FEEDS, abi.encodeWithSignature("getPriceTimestamp(bytes32)", KEY));

        // emit log("getPriceTimestampHeartbeat()");
        // _umbrellaFeeds_gasCost(FEEDS, abi.encodeWithSignature("getPriceTimestampHeartbeat(bytes32)", KEY));

        // emit log("getPriceData()");
        // _umbrellaFeeds_gasCost(FEEDS, abi.encodeWithSignature("getPriceData(bytes32)", KEY));
    }


    /*
    forge test -vvv --match-test test_gas_UmbrellaFeedsReader --fork-url https://api.avax-test.network/ext/bc/C/rpc
    */
    function off_gas_UmbrellaFeedsReader() public {
        address factory = REGISTRY.getAddress(bytes32("UmbrellaFeedsReaderFactory"));
        address reader = address(UmbrellaFeedsReaderFactory(factory).deployed("UMB-USD"));

        assertTrue(reader != address(0));

        // NOTICE: to see real gas cost uncomment only one test case at a time
        // emit log("latestRoundData()");
        // _umbrellaFeeds_gasCost(reader, abi.encodeWithSignature("latestRoundData()"));

        emit log("getPriceData()");
        _umbrellaFeeds_gasCost(reader, abi.encodeWithSignature("getPriceData()"));
    }

    /*
    to test fallback use block 21978008 and 0x2663BFC8D0C833F602F6fF74482C113187cb0e1e as FEED
    forge test -vvv --match-test test_gas_UmbrellaFeeds_fallback --fork-url https://api.avax-test.network/ext/bc/C/rpc --fork-block-number 21978008
    */
    function off_gas_UmbrellaFeeds_fallback() public {
        // NOTICE: to see real gas cost uncomment only one test case at a time
        emit log("getPrice()");
        _umbrellaFeeds_gasCost(FEEDS_FALLBACK, abi.encodeWithSignature("getPrice(bytes32)", KEY));

        // emit log("getPriceTimestamp()");
        // _umbrellaFeeds_gasCost(FEEDS_FALLBACK, abi.encodeWithSignature("getPriceTimestamp(bytes32)", KEY));

        // emit log("getPriceTimestampHeartbeat()");
        // _umbrellaFeeds_gasCost(FEEDS_FALLBACK, abi.encodeWithSignature("getPriceTimestampHeartbeat(bytes32)", KEY));

        // emit log("getPriceData()");
        // _umbrellaFeeds_gasCost(FEEDS_FALLBACK, abi.encodeWithSignature("getPriceData(bytes32)", KEY));
    }

    /*
    forge test -vvv --gas-report --match-test test_gas_signatureVerification --fork-url https://api.avax-test.network/ext/bc/C/rpc --fork-block-number 21977630
    */
    function off_gas_signatureVerification() public {
        bytes32[] memory priceKeys = new bytes32[](1);
        UmbrellaFeeds.PriceData[] memory priceDatas = new UmbrellaFeeds.PriceData[](1);
        UmbrellaFeeds.Signature[] memory signatures = new UmbrellaFeeds.Signature[](2);

        priceKeys[0] = bytes32(0xbbdedfe22c85021ba8e1d8cdd85e10fe13dfb36690e2b605e559d2a59c6d3b6f);
        priceDatas[0].heartbeat = 43200;
        priceDatas[0].timestamp = 1684255296;
        priceDatas[0].price = 1096486;

        signatures[0].v = 27;
        signatures[0].r = bytes32(0x3494652adf2578ff996c61966fbba9591adbf9c397bdae1139b40faf9b330f9c);
        signatures[0].s = bytes32(0x45548b7bf83fff4b61355e291111c70689ec93e3c5ce2387b7525a0b5be52f18);

        signatures[1].v = 28;
        signatures[1].r = bytes32(0xe152e514bb4bfbc6a5c7fef08dc07adfb92e82286e1398c1a5ca9928a627d640);
        signatures[1].s = bytes32(0x0efac4f2d1a21bce594058864fa8216bca06eb0597c15a1bcd1167ec62e0429d);


        uint256 gasLeft = gasleft();
        UmbrellaFeeds(address(FEEDS)).update(priceKeys, priceDatas, signatures);
        uint256 umbrellaGas = gasLeft - gasleft();

        emit log_named_uint("umbrella gas cost for 2 signatures:", umbrellaGas);

        StakingBankStaticLocal bank = new StakingBankStaticLocal(1);
        address[] memory addresses = new address[](1);
        addresses[0] = address(bank);

        cheats.prank(address(0x66f13FDceed822E74b6a1e08e082Fa699fF36454));
        REGISTRY.importContracts(addresses);
        // emit log("getPriceTimestamp()");
        // _umbrellaFeeds_gasCost(FEEDS_FALLBACK, abi.encodeWithSignature("getPriceTimestamp(bytes32)", KEY));

        // emit log("getPriceTimestampHeartbeat()");
        // _umbrellaFeeds_gasCost(FEEDS_FALLBACK, abi.encodeWithSignature("getPriceTimestampHeartbeat(bytes32)", KEY));

        // emit log("getPriceData()");
        // _umbrellaFeeds_gasCost(FEEDS_FALLBACK, abi.encodeWithSignature("getPriceData(bytes32)", KEY));
    }

    function getName() public pure returns (bytes32) {
        return "UmbrellaFeeds";
    }

    function _umbrellaFeeds_gasCost(address _destination, bytes memory _calldata) internal {
        uint256 gasLeft = gasleft();
        (bool success,) = _destination.staticcall(_calldata);
        uint256 umbrellaGas = gasLeft - gasleft();

        assertTrue(success);

        emit log_named_uint("umbrella gas cost:", umbrellaGas);
        emit log_named_uint("calculation done on block:", block.number);
        emit log_named_uint("calculation done at time:", block.timestamp);
    }
}
