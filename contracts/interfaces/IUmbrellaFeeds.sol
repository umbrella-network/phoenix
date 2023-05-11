// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

/// @dev Main contract for all deviation triggered fees.
/// This contract has build in fallback feature in case it will be replaced by newer version.
/// Fallback is transparent for the user, no additional setup is needed.
///
/// How fallback feature works? If data for provided key is empty, contract will execute following procedure:
/// 1. triggered feeds, that needs to be updated will be updated in new contract and erased from this one
/// 2. if data is empty, check, if new deployment of UmbrellaFeeds is done, if not stop.
/// 3. forward the call to that new contract.
///
/// After new deployment done it is recommended to update address to avoid fallback and reduce gas cost.
/// In long run this is most efficient solution, better than any proxy.
interface IUmbrellaFeeds {
    struct PriceData {
        uint8 data;
        uint24 heartbeat;
        uint32 timestamp;
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
    // solhint-disable-next-line function-max-lines, code-complexity
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
    /// In case ony of feeds timestamp is empty, fallback call will be executed for that feed.
    /// If any of feeds fallback calls fail, function will revert.
    /// @param _keys array of feed keys
    /// @return data PriceData array
    function getPricesData(bytes32[] calldata _keys) external view returns (PriceData[] memory data);

    /// @dev same as getPricesData() but does not revert on empty data.
    function getPricesDataRaw(bytes32[] calldata _keys) external view returns (PriceData[] memory data);

    /// @dev this is main endpoint for reading feeds.
    /// In case timestamp is empty (that means there is no data), contract will execute fallback call.
    /// Check contract description for fallback details.
    function getPriceData(bytes32 _key) external view returns (PriceData memory data);

    /// @dev same as `getPriceData` but does not revert when no data
    function getPriceDataRaw(bytes32 _key) external view returns (PriceData memory data);

    function DECIMALS() external view returns (uint8); // solhint-disable-line func-name-mixedcase
}
