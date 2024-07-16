// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import {ISovrynSwapNetwork} from "./ISovrynSwapNetwork.sol";
import {CommonFetcher} from "../CommonFetcher.sol";

contract SovrynFetcherHelper is CommonFetcher {
    struct InputData {
        address base;
        address quote;
        uint8 amountInDecimals;
    }

    /// @param price is amount out (normalized to 18 decimals) returned by Sovryn pool for 1 quote token
    struct Price {
        uint256 price;
        bool success;
    }

    ISovrynSwapNetwork immutable public sovrynSwapNetwork;

    constructor(address _sovrynSwapNetwork) {
        sovrynSwapNetwork = ISovrynSwapNetwork(_sovrynSwapNetwork);
    }

    /// @dev this method will return estimations for swap for provided amounts
    function getPrices(InputData[] calldata _data)
        external
        view
        virtual
        returns (Price[] memory prices, uint256 timestamp)
    {
        timestamp = block.timestamp;
        uint256 n = _data.length;
        prices = new Price[](n);

        for (uint256 i = 0; i < n; i++) {
            prices[i] = _getPrice(_data[i]);
        }
    }

    function _getPrice(InputData memory _data)
        internal
        view
        virtual
        returns (Price memory price)
    {
        (uint256 baseDecimals, bool baseHasDecimals) = _decimals(_data.base);
        if (!baseHasDecimals) return price;

        (uint256 quoteDecimals, bool quoteHasDecimals) = _decimals(_data.quote);
        if (!quoteHasDecimals) return price;

        (address[] memory path, bool success) = _conversionPath(_data.base, _data.quote);
        if (!success) return price;

        (price.price, success) = _rateByPath(path, 10 ** _data.amountInDecimals);
        if (!success) return price;

        price.success = true;
        price.price = _normalizeOneTokenPrice(_data.amountInDecimals, baseDecimals, quoteDecimals, price.price);
    }

    function _conversionPath(address _base, address _quote)
        internal
        view
        returns (address[] memory conversionPath, bool success)
    {
        try sovrynSwapNetwork.conversionPath(_base, _quote) returns (address[] memory path) {
            return (path, true);
        } catch (bytes memory) {
            // error
        }
    }

    function _rateByPath(address[] memory _path, uint256 _amountIn)
        internal
        view
        returns (uint256 amountOut, bool success)
    {
        try sovrynSwapNetwork.rateByPath(_path, _amountIn) returns (uint256 result) {
            return (result, true);
        } catch (bytes memory) {
            // error
        }
    }
}
