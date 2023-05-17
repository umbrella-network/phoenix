pragma solidity ^0.8.0;

import "ds-test/test.sol";
import "../lib/CheatCodes.sol";

import "../../contracts/onChainFeeds/UmbrellaFeeds.sol";
import "../../contracts/onChainFeeds/UmbrellaFeedsReaderFactory.sol";
import "../../contracts/interfaces/AggregatorV3Interface.sol";

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

    function getName() public pure returns (bytes32) {
        return "UmbrellaFeeds";
    }

    function _umbrellaFeeds_gasCost(address _destination, bytes memory _calldata) internal {
        bytes32 key = keccak256(abi.encodePacked("UMB-USD"));


        uint256 gasLeft = gasleft();
        (bool success, bytes memory data) = _destination.staticcall(_calldata);
        uint256 umbrellaGas = gasLeft - gasleft();

        assertTrue(success);

        emit log_named_uint("umbrella gas cost:", umbrellaGas);
        emit log_named_uint("calculation done on block:", block.number);
        emit log_named_uint("calculation done at time:", block.timestamp);
    }
}
