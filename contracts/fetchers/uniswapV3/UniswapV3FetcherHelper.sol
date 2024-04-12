// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import {console} from "hardhat/console.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IQuoter} from "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";
import {IQuoterV2} from "gitmodules/uniswap/v3-periphery/contracts/interfaces/IQuoterV2.sol";


contract UniswapV3FetcherHelper {
    // copy from @uniswap/v3-core/contracts/libraries/TickMath.sol, because of solidity versions restriction
    uint160 internal constant MIN_SQRT_RATIO = 4295128739;

    // copy from @uniswap/v3-core/contracts/libraries/TickMath.sol, because of solidity versions restriction
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    bytes4 public constant SYMBOL_SELECTOR = bytes4(keccak256("symbol()"));
    bytes4 public constant DECIMALS_SELECTOR = bytes4(keccak256("decimals()"));

    bytes4 public constant QUOTE_EXACT_INPUT_SINGLE_SELECTOR = bytes4(
        keccak256("quoteExactInputSingle(address,address,uint256,uint24,uint160)")
    );

    bytes4 public constant QUOTER_SELECTOR = bytes4(
        keccak256("quoter(address,address,address,uint256)")
    );

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
            (bool success, bytes memory data) = _tokens[i].staticcall(abi.encode(SYMBOL_SELECTOR));

            symbols[i] = success
                ? data.length == 32 ? string(abi.encodePacked(data)) : abi.decode(data, (string))
                : "";
        }
    }

    function getPrices(PriceData[] calldata _data)
        external
//        view
        virtual
        returns (Price[] memory prices, uint256 timestamp)
    {
        timestamp = block.timestamp;
        uint256 n = _data.length;
        prices = new Price[](n);

        for (uint256 i = 0; i < n; i++) {
            PriceData memory data = _data[i];

            IUniswapV3Pool pool = findBiggestPool(data.pools, data.quote);

//            prices[i].price = uniswapV3Quoter.quoteExactInputSingle(
//                data.base, data.quote, pool.fee(), 10 ** _decimals(data.base), 0
//            );
//

            uint256 baseDecimals = _decimals(data.base);
            uint256 quoteDecimals = _decimals(data.quote);

            (prices[i].price,,,) = uniswapV3Quoter.quoteExactInputSingle(
                IQuoterV2.QuoteExactInputSingleParams(data.base, data.quote, 10 ** baseDecimals, pool.fee(), 0)
            );

            if (quoteDecimals > 18) {
                prices[i].price /= 10 ** (quoteDecimals - 18);
            } else {
                prices[i].price *= 10 ** (18 - quoteDecimals);
            }

            prices[i].success = true;

//            (bool success, bytes memory result) = address(uniswapV3Quoter).call(
//                abi.encode(QUOTE_EXACT_INPUT_SINGLE_SELECTOR, data.base, data.quote, 10 ** _decimals(data.base), pool.fee(), 0)
//            );

//            console.log('reason#5');
//
//            if (success) {
//                (prices[i].price,,,) = abi.decode(result, (uint256, uint160, uint32, uint256));
//                prices[i].success = true;
//            }

//            (bool success, bytes memory result) = address(this).staticcall(
//                abi.encode(QUOTER_SELECTOR, pool, data.base, data.quote, 10 ** _decimals(data.base))
//            );

//            if (success) {
//                prices[i].price = abi.decode(result, (uint256));
//                prices[i].success = true;
//            }
        }
    }

    /// @dev based on https://github.com/Uniswap/v3-periphery/blob/main/contracts/lens/Quoter.sol
    /// in order not to rely on Quoter to be deployed on every blockchain and testnet, we can simply copy the code
    function quoter(
        IUniswapV3Pool _pool,
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn
    )
        external
        virtual
        returns (uint256 amountOut, string memory error)
    {
        bool zeroForOne = _tokenIn < _tokenOut;

        try
            _pool.swap(
                address(this), // address(0) might cause issues with some tokens
                zeroForOne,
                int256(_amountIn),
                (zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1),
                abi.encodePacked(_tokenIn, _pool.fee(), _tokenOut)
            )
        {} catch (bytes memory reason) {
            return _parseRevertReason(reason);
        }
    }

    /// @param _pool uniswap V3 pool address
    /// @return lastObservationTimestamp last observation timestamp
    function poolTimestamp(IUniswapV3Pool _pool) public view virtual returns (uint32 lastObservationTimestamp) {
        (, , uint16 observationIndex, , , , ) = _pool.slot0();
        (uint32 blockTimestamp, , , bool initialized) = _pool.observations(observationIndex);

        lastObservationTimestamp = initialized ? blockTimestamp : 0;
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
        (bool success, bytes memory data) = _token.staticcall(abi.encode(DECIMALS_SELECTOR));
        if (!success) revert NoDecimals();

        decimals = abi.decode(data, (uint256));
    }

    /// @dev Parses a revert reason that should contain the numeric quote
    function _parseRevertReason(bytes memory reason) internal view virtual returns (uint256 amountOut, string memory errorMsg) {
        if (reason.length != 32) {
            if (reason.length < 68) return (0, 'Unexpected error');

            assembly {
                reason := add(reason, 0x04)
            }

            console.log(string(abi.decode(reason, (string))), 'reason#2');
            return (0, abi.decode(reason, (string)));
        }

        console.log(uint256(abi.decode(reason, (uint256))), 'reason#3');

        return (abi.decode(reason, (uint256)), '');
    }
}
