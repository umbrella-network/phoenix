pragma solidity 0.8.13;


//SPDX-License-Identifier: MIT
interface IRegistry {
    event LogRegistered(address indexed destination, bytes32 name);

    /// @dev imports new contract addresses and override old addresses, if they exist under provided name
    /// This method can be used for contracts that for some reason do not have `getName` method
    /// @param  _names array of contract names that we want to register
    /// @param  _destinations array of contract addresses
    function importAddresses(bytes32[] calldata _names, address[] calldata _destinations) external;

    /// @dev imports new contracts and override old addresses, if they exist.
    /// Names of contracts are fetched directly from each contract by calling `getName`
    /// @param  _destinations array of contract addresses
    function importContracts(address[] calldata _destinations) external;

    /// @dev this method ensure, that old and new contract is aware of it state in registry
    /// Note: BSC registry does not have this method. This method was introduced in later stage.
    /// @param _newContract address of contract that will replace old one
    function atomicUpdate(address _newContract) external;

    /// @dev similar to `getAddress` but throws when contract name not exists
    /// @param name contract name
    /// @return contract address registered under provided name or throws, if does not exists
    function requireAndGetAddress(bytes32 name) external view returns (address);

    /// @param name contract name in a form of bytes32
    /// @return contract address registered under provided name
    function getAddress(bytes32 name) external view returns (address);

    /// @param _name contract name
    /// @return contract address assigned to the name or address(0) if not exists
    function getAddressByString(string memory _name) external view returns (address);

    /// @dev helper method that converts string to bytes32,
    /// you can use to to generate contract name
    function stringToBytes32(string memory _string) external pure returns (bytes32 result);
}

// SPDX-License-Identifier: MIT
interface IUmbrellaFeeds {
    struct PriceData {
        /// @dev this is placeholder, that can be used for some additional data
        /// atm of creating this smart contract, it is only used as marker for removed data (when == type(uint8).max)
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
    /// In case timestamp is empty (that means there is no data), contract will revert.
    /// If you do not need whole data from `PriceData` struct, you can save some gas by using other view methods that
    /// returns just what you need.
    /// @notice method will revert if data for `_key` not exists.
    /// @param _key hash of feed name
    /// @return data full PriceData struct
    function getPriceData(bytes32 _key) external view returns (PriceData memory data);

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

// SPDX-License-Identifier: MIT
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