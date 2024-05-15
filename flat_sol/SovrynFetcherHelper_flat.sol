// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;


interface ISovrynSwapNetwork {
    /**
      * @dev returns the conversion path between two tokens in the network
      * note that this method is quite expensive in terms of gas and should generally be called off-chain
      *
      * @param _sourceToken source token address
      * @param _targetToken target token address
      *
      * @return conversion path between the two tokens
    */
    function conversionPath(address _sourceToken, address _targetToken) external view returns (address[] memory);

    /**
      * @dev returns the expected target amount of converting a given amount on a given path
      * note that there is no support for circular paths
      *
      * @param _path        conversion path (see conversion path format above)
      * @param _amount      amount of _path[0] tokens received from the sender
      *
      * @return expected target amount
    */
    function rateByPath(address[] calldata _path, uint256 _amount) external view returns (uint256);
}

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
