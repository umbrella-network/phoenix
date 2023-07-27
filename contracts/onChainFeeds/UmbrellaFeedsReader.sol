// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "../interfaces/IRegistry.sol";
import "../interfaces/IUmbrellaFeeds.sol";

/// @dev This is optional price reader for just one feed.
/// It comes with chanilink interface that makes migration process easier.
/// For maximum gas optimisation it is recommended to use UmbrellaFeeds directly - simply follow this contract as
/// a guide for integration.
///
/// This contract has build in fallback feature in case, `UmbrellaFeeds` will be replaced by newer contract.
/// Fallback is transparent for the user, no additional setup is needed.
///
/// How fallback feature works? If data for provided key is empty (when UmbrellaFeeds was destroyed and replaced),
/// contract will execute following procedure:
/// 1. if data is empty, contract will check if there is new registered contract with requested data
/// 2. if data is found in new contract it will be returned
/// 3. if there is no data or there is no new contract tx will revert.
contract UmbrellaFeedsReader {
    /// @dev Registry contract where list of all addresses is stored. Fallback feature uses this registry to
    /// resolve newest `UmbrellaFeeds` address
    IRegistry public immutable REGISTRY;  // solhint-disable-line var-name-mixedcase

    /// @dev contract where all the feeds are stored
    address public immutable UMBRELLA_FEEDS;  // solhint-disable-line var-name-mixedcase

    /// @dev key (hash of string key), under which feed is being stored
    bytes32 public immutable KEY;  // solhint-disable-line var-name-mixedcase

    /// @dev string representation of feed key (feed name)
    string public description;

    /// @dev decimals for feed
    uint8 internal immutable _DECIMALS;  // solhint-disable-line var-name-mixedcase

    error EmptyAddress();
    error FeedNotExist();

    /// @param _registry IRegistry address
    /// @param _umbrellaFeeds UmbrellaFeeds address
    /// @param _key price data key (before hashing)
    constructor(IRegistry _registry, IUmbrellaFeeds _umbrellaFeeds, string memory _key) {
        if (address(_registry) == address(0)) revert EmptyAddress();

        REGISTRY = _registry;
        UMBRELLA_FEEDS = address(_umbrellaFeeds);
        description = _key;
        _DECIMALS = _umbrellaFeeds.DECIMALS();

        bytes32 hash = keccak256(abi.encodePacked(_key));
        KEY = hash;

        // sanity check
        _umbrellaFeeds.getPriceData(hash);
    }

    /// @dev decimals for feed
    function decimals() external view returns (uint8) {
        return _DECIMALS;
    }

    /// @dev this method follows chainlink interface for easy migration, NOTE: not all returned data are covered!
    /// latestRoundData() raise exception when there is no data, instead of returning unset values,
    /// which could be misinterpreted as actual reported values.
    /// It DOES NOT raise when data is outdated (based on heartbeat and timestamp).
    /// @notice You can save some gas by doing call directly to `UMBRELLA_FEEDS` contract.
    /// @return uint80 originally `roundId`, not in use, always 0
    /// @return answer price
    /// @return uint256 originally `startedAt`, not in use, always 0
    /// @return updatedAt last timestamp data was updated
    /// @return uint80 originally `answeredInRound` not in use, always 0
    function latestRoundData()
        external
        view
        returns (
            uint80 /* roundId */,
            int256 answer,
            uint256 /* startedAt */,
            uint256 updatedAt,
            uint80 /* answeredInRound */
        )
    {
        IUmbrellaFeeds.PriceData memory priceData = _getPriceDataRaw();

        if (priceData.timestamp == 0) {
            priceData = _fallbackCall();
        }

        return (0, int256(uint256(priceData.price)), 0, priceData.timestamp, 0);
    }

    /// @dev this is main endpoint for reading feed. Feed is read from UmbrellaFeeds contract using hardcoded `KEY`.
    /// In case timestamp is empty (that means there is no data), contract will execute fallback call.
    /// @notice revert on empty data
    function getPriceData() external view returns (IUmbrellaFeeds.PriceData memory priceData) {
        priceData = _getPriceDataRaw();

        if (priceData.timestamp == 0) {
            priceData = _fallbackCall();
        }
    }

    /// @dev same as `getPriceData` but does not revert when no data
    function getPriceDataRaw() external view returns (IUmbrellaFeeds.PriceData memory priceData) {
        priceData = _getPriceDataRaw();

        if (priceData.timestamp == 0) {
            return _fallbackCallRaw();
        }
    }

    /// @dev same as `getPriceData` but does not revert when no data
    function _getPriceDataRaw() internal view returns (IUmbrellaFeeds.PriceData memory priceData) {
        (bool success, bytes memory data) = UMBRELLA_FEEDS.staticcall(
            abi.encodeWithSelector(IUmbrellaFeeds.prices.selector, KEY)
        );

        if (success && data.length != 0) {
            priceData = abi.decode(data, (IUmbrellaFeeds.PriceData));
        }
    }

    /// @dev it will revert on empty data
    function _fallbackCall() internal view returns (IUmbrellaFeeds.PriceData memory data) {
        address umbrellaFeeds = REGISTRY.getAddressByString("UmbrellaFeeds");

        // if contract was NOT updated, fallback is not needed, data does not exist - revert
        if (umbrellaFeeds == UMBRELLA_FEEDS) revert FeedNotExist();

        data = IUmbrellaFeeds(umbrellaFeeds).getPriceData(KEY);
    }

    /// @dev it will not revert on empty data
    function _fallbackCallRaw() internal view returns (IUmbrellaFeeds.PriceData memory data) {
        address umbrellaFeeds = REGISTRY.getAddressByString("UmbrellaFeeds");

        // if contract was updated, we do fallback
        if (umbrellaFeeds != UMBRELLA_FEEDS) {
            data = IUmbrellaFeeds(umbrellaFeeds).prices(KEY);
        }
    }
}
