// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IUmbrellaFeeds {
    struct PriceData {
        /// @dev placeholder, not in use yet
        uint8 data;
        /// @dev heartbeat: how often price data will be refreshed in case price stay flat
        uint24 heartbeat;
        /// @dev timestamp: price time, at this time validators run consensus
        uint32 timestamp;
        /// @dev price
        uint128 price;
    }

    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /// @dev method for submitting consensus data
    /// @param _priceKeys array of keys for `_priceDatas`
    /// @param _priceDatas PriceData signed by validators
    /// @param _signatures validators signatures
    function update(
        bytes32[] calldata _priceKeys,
        PriceData[] calldata _priceDatas,
        Signature[] calldata _signatures
    ) external;

    /// @dev method for resetting data
    /// @param _priceKeys array of keys for `_priceDatas`
    /// @param _signatures validators signatures
    function reset(bytes32[] calldata _priceKeys, Signature[] calldata _signatures) external;

    /// @dev it will return array of price datas for provided `_keys`
    /// In case ony of feed does not exist, fallback call will be executed for that feed.
    /// @notice If data for any key not exists, function will revert. Use `getManyPriceDataRaw` method if you don't
    /// want revert.
    /// @param _keys array of feed keys
    /// @return data PriceData array
    function getManyPriceData(bytes32[] calldata _keys) external view returns (PriceData[] memory data);

    /// @dev same as getManyPriceData() but does not revert on empty data.
    /// @notice This method does no revert if some data does not exists.
    /// Check `data.timestamp` to see if price exist, if it is 0, then it does not exist.
    function getManyPriceDataRaw(bytes32[] calldata _keys) external view returns (PriceData[] memory data);

    /// @dev this is main endpoint for reading feeds.
    /// In case timestamp is empty (that means there is no data), contract will execute fallback call.
    /// Check main contract description for fallback details.
    /// If you do not need whole data from `PriceData` struct, you can save some gas by using other view methods that
    /// returns just what you need.
    /// @notice method will revert if data for `_key` not exists.
    /// @param _key hash of feed name
    /// @return data full PriceData struct
    function getPriceData(bytes32 _key) external view returns (PriceData memory data);

    /// @notice same as `getPriceData` but does not revert when no data
    /// @param _key hash of feed name
    /// @return data full PriceData struct
    function getPriceDataRaw(bytes32 _key) external view returns (PriceData memory data);

    /// @notice reader for mapping
    /// @param _key hash of feed name
    /// @return data full PriceData struct
    function prices(bytes32 _key) external view returns (PriceData memory data);

    /// @notice method will revert if data for `_key` not exists.
    /// @param _key hash of feed name
    /// @return price
    function getPrice(bytes32 _key) external view returns (uint128 price);

    /// @notice method will revert if data for `_key` not exists.
    /// @param _key hash of feed name
    /// @return price
    /// @return timestamp
    function getPriceTimestamp(bytes32 _key) external view returns (uint128 price, uint32 timestamp);

    /// @notice method will revert if data for `_key` not exists.
    /// @param _key hash of feed name
    /// @return price
    /// @return timestamp
    /// @return heartbeat
    function getPriceTimestampHeartbeat(bytes32 _key)
        external
        view
        returns (uint128 price, uint32 timestamp, uint24 heartbeat);

    /// @dev This method should be used only for Layer2 as it is more gas consuming than others views.
    /// @notice It does not revert on empty data.
    /// @param _name string feed name
    /// @return data PriceData
    function getPriceDataByName(string calldata _name) external view returns (PriceData memory data);

    /// @dev decimals for prices stored in this contract
    function DECIMALS() external view returns (uint8); // solhint-disable-line func-name-mixedcase
}
