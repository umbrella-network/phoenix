// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IUniswapV3Factory} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IUniswapV3PoolImmutables} from "@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolImmutables.sol";
import {IQuoterV2} from "gitmodules/uniswap/v3-periphery/contracts/interfaces/IQuoterV2.sol";

import {CommonFetcher} from "../CommonFetcher.sol";

contract UniswapV3FetcherHelper is CommonFetcher {
    struct InputData {
        IUniswapV3Pool pool;
        address base;
        address quote;
        uint8 amountInDecimals;
    }

    /// @param price is amount out (normalized to 18 decimals) returned by Uniswap pool for 1 quote token
    struct Price {
        uint256 price;
        bool success;
    }

    struct LiquidityData {
        uint160 sqrtPriceX96;
        int24 tick;
        uint256 liquidity;
    }

    bytes4 internal constant _SYMBOL_SELECTOR = bytes4(keccak256("symbol()"));

    IUniswapV3Factory immutable public uniswapV3Factory;
    IQuoterV2 immutable public uniswapV3Quoter;

    constructor(IUniswapV3Factory _factory, IQuoterV2 _quoter) {
        uniswapV3Factory = _factory;
        uniswapV3Quoter = _quoter;
    }

    /// @dev this method will return estimations for swap for one base token
    /// it can not be view, but to get estimation you have to call it in a static way
    /// Tokens that do not have `.decimals()` are not supported
    /// @param _data array of PriceData, each PriceData can accept multiple pools per one price, price is fetched from
    /// pool, that has biggest liquidity (quote.balanceOf(pool))
    /// @return prices prices normalized from input amount (10 ** prices[n].amountInDecimals) to one token price
    function getPrices(InputData[] calldata _data)
        external
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

    function liquidityData(IUniswapV3Pool[] calldata _pools)
        external
        view
        virtual
        returns (LiquidityData[] memory data)
    {
        uint256 n = _pools.length;
        data = new LiquidityData[](n);

        for (uint256 i = 0; i < n; i++) {
            IUniswapV3Pool pool = _pools[i];
            (data[i].sqrtPriceX96, data[i].tick,,,,,) = pool.slot0();
            data[i].liquidity = pool.liquidity();
        }
    }

    function _getPrice(InputData memory _data) internal virtual returns (Price memory price) {
        (uint256 baseDecimals, bool baseHasDecimals) = _decimals(_data.base);
        if (!baseHasDecimals) return price;

        (uint256 quoteDecimals, bool quoteHasDecimals) = _decimals(_data.quote);
        if (!quoteHasDecimals) return price;

        if (address(_data.pool) == address(0)) return price;

        (uint24 fee, bool success) = _getPoolFee(_data.pool);
        if (!success) return price;

        if (address(_data.pool) != _getPool(_data.base, _data.quote, fee)) return price;

        IQuoterV2.QuoteExactInputSingleParams memory params = IQuoterV2.QuoteExactInputSingleParams({
            tokenIn: _data.base,
            tokenOut: _data.quote,
            amountIn: 10 ** _data.amountInDecimals,
            fee: fee,
            sqrtPriceLimitX96: 0
        });

        try uniswapV3Quoter.quoteExactInputSingle(params)
            returns (uint256 tokenPrice, uint160, uint32, uint256)
        {
            price.price = _normalizeOneTokenPrice(_data.amountInDecimals, baseDecimals, quoteDecimals, tokenPrice);
            price.success = true;
        } catch (bytes memory) {
            // continue;
        }
    }

    function _getPool(address _token0, address _token1, uint24 _fee) internal view virtual returns (address pool) {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory data) = address(uniswapV3Factory).staticcall(
            abi.encodeWithSelector(IUniswapV3Factory.getPool.selector, _token0, _token1, _fee)
        );

        if (success) pool = abi.decode(data, (address));
    }

    function _getPoolFee(IUniswapV3Pool _pool) internal view virtual returns (uint24 fee, bool success) {
        bytes memory data;

        // solhint-disable-next-line avoid-low-level-calls
        (success, data) = address(_pool).staticcall(abi.encodeWithSelector(IUniswapV3PoolImmutables.fee.selector));

        if (data.length == 0) {
            success = false;
        } else if (success) {
            fee = abi.decode(data, (uint24));
        }
    }
}
