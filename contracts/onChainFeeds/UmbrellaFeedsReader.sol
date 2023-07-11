// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "../interfaces/IUmbrellaFeeds.sol";

/// @dev This is optional price reader for just one feed.
/// It comes with chanilink interface that makes migration process easier.
/// For maximum gas optimisation it is recommended to use UmbrellaFeeds directly.
contract UmbrellaFeedsReader {
    /// @dev contract where all the feeds are stored
    IUmbrellaFeeds public immutable UMBRELLA_FEEDS;  // solhint-disable-line var-name-mixedcase

    /// @dev key (hash of string key), under which feed is being stored
    bytes32 public immutable KEY;  // solhint-disable-line var-name-mixedcase

    /// @dev decimals for feed
    uint8 public immutable DECIMALS;  // solhint-disable-line var-name-mixedcase

    /// @dev string representation of feed key (feed name)
    string public DESCRIPTION;  // solhint-disable-line var-name-mixedcase
    
    /// @param _umbrellaFeeds UmbrellaFeeds address
    /// @param _key price data key (before hashing)
    constructor(IUmbrellaFeeds _umbrellaFeeds, string memory _key) {
        UMBRELLA_FEEDS = _umbrellaFeeds;
        DESCRIPTION = _key;
        DECIMALS = _umbrellaFeeds.DECIMALS();

        bytes32 hash = keccak256(abi.encodePacked(_key));
        KEY = hash;

        // sanity check
        _umbrellaFeeds.getPriceData(hash);
    }

    /// @dev decimals for feed
    function decimals() external view returns (uint8) {
        return DECIMALS;
    }

    /// @dev string representation of feed key
    function description() external view returns (string memory) {
        return DESCRIPTION;
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
        IUmbrellaFeeds.PriceData memory data = UMBRELLA_FEEDS.getPriceData(KEY);
        return (0, int256(uint256(data.price)), 0, data.timestamp, 0);
    }

    /// @dev this is main endpoint for reading feed. Feed is read from UmbrellaFeeds contract using hardcoded `KEY`.
    /// In case timestamp is empty (that means there is no data), contract will execute fallback call.
    /// Check UmbrellaFeeds contract description for fallback details.
    function getPriceData() external view returns (IUmbrellaFeeds.PriceData memory) {
        return UMBRELLA_FEEDS.getPriceData(KEY);
    }

    /// @dev same as `getPriceData` but does not revert when no data
    function getPriceDataRaw() external view returns (IUmbrellaFeeds.PriceData memory) {
        return UMBRELLA_FEEDS.getPriceDataRaw(KEY);
    }
}
