// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import {ISovrynSwapNetwork} from "./ISovrynSwapNetwork.sol";

contract SovrynFetcherHelper {
    struct InputData {
        address base;
        address quote;
        uint256 amount;
    }

    /// @param price is amount out (normalized to 18 decimals) returned by Uniswap pool for 1 quote token
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
            InputData memory inputData = _data[i];
            Price memory price = prices[i];

            (address[] memory path, bool success) = _conversionPath(inputData.base, inputData.quote);
            if (!success) continue;

            (price.price, success) = _rateByPath(path, inputData.amount);
            if (!success) continue;

            price.success = true;
        }
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
