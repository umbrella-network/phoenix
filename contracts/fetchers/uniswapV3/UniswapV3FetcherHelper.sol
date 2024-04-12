// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IQuoterV2} from "gitmodules/uniswap/v3-periphery/contracts/interfaces/IQuoterV2.sol";


contract UniswapV3FetcherHelper {
    bytes4 internal constant _SYMBOL_SELECTOR = bytes4(keccak256("symbol()"));
    bytes4 internal constant _DECIMALS_SELECTOR = bytes4(keccak256("decimals()"));

    IQuoterV2 immutable uniswapV3Quoter;

    error NoDecimals();

    struct PriceData {
        IUniswapV3Pool[] pools;
        address base;
        address quote;
    }

    /// @param price is amount out (normalized to 18 decimals) returned by Uniswap pool for 1 quote token
    struct Price {
        uint256 price;
        bool success;
    }

    constructor(IQuoterV2 _quoter) {
        uniswapV3Quoter = _quoter;
    }

    function tokensSymbols(address[] calldata _tokens) external view virtual returns (string[] memory symbols) {
        uint256 n = _tokens.length;
        symbols = new string[](n);

        for (uint256 i = 0; i < n; i++) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, bytes memory data) = _tokens[i].staticcall(abi.encode(_SYMBOL_SELECTOR));

            symbols[i] = success
                ? data.length == 32 ? string(abi.encodePacked(data)) : abi.decode(data, (string))
                : "";
        }
    }

    /// @dev this method will return estimations for swap for one base otken
    /// it can not be view, but to get estimation you have to call it in a static way
    function getPrices(PriceData[] calldata _data)
        external
        virtual
        returns (Price[] memory prices, uint256 timestamp)
    {
        timestamp = block.timestamp;
        uint256 n = _data.length;
        prices = new Price[](n);

        for (uint256 i = 0; i < n; i++) {
            PriceData memory data = _data[i];
            Price memory price = prices[i];

            IUniswapV3Pool pool = findBiggestPool(data.pools, data.quote);

            uint256 oneBaseToken =  10 ** _decimals(data.base);
            uint256 quoteDecimals = _decimals(data.quote);

            (bool success, bytes memory result) = address(uniswapV3Quoter).call(abi.encodeWithSelector(
                IQuoterV2.quoteExactInputSingle.selector, data.base, data.quote, oneBaseToken, pool.fee(), 0
            ));

            if (success) {
                (price.price,,,) = abi.decode(result, (uint256, uint160, uint32, uint256));
                price.success = true;
            }

            if (quoteDecimals == 18) {
                // price OK
            } else if (quoteDecimals > 18) {
                price.price /= 10 ** (quoteDecimals - 18);
            } else {
                price.price *= 10 ** (18 - quoteDecimals);
            }
        }
    }

    /// @dev finds pool with biggest quote liquidity
    function findBiggestPool(IUniswapV3Pool[] memory _pools, address _quote)
        public
        view
        virtual
        returns (IUniswapV3Pool biggestPool)
    {
        uint256 biggestBalance = 0;

        for (uint256 i = 0; i < _pools.length; i++) {
            IUniswapV3Pool pool = _pools[i];
            uint256 balance = IERC20(_quote).balanceOf(address(pool));

            if (balance > biggestBalance) {
                biggestPool = pool;
                biggestBalance = balance;
            }
        }
    }

    function _decimals(address _token) public view virtual returns (uint256 decimals) {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory data) = _token.staticcall(abi.encode(_DECIMALS_SELECTOR));
        if (!success) revert NoDecimals();

        decimals = abi.decode(data, (uint256));
    }
}
