// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract CommonFetcher {
    uint256 internal constant _DECIMALS = 18;
    bytes4 internal constant _DECIMALS_SELECTOR = bytes4(keccak256("decimals()"));

    function _decimals(address _token) internal view virtual returns (uint256 decimals, bool success) {
        bytes memory data;

        // solhint-disable-next-line avoid-low-level-calls
        (success, data) = _token.staticcall(abi.encode(_DECIMALS_SELECTOR));
        if (success && data.length != 0) decimals = abi.decode(data, (uint256));
        else success = false;
    }

    function _normalizeOneTokenPrice(
        uint256 _amountInDecimals,
        uint256 _baseDecimals,
        uint256 _quoteDecimals,
        uint256 _price
    )
        internal
        pure
        virtual
        returns (uint256 normalizedPrice)
    {
        // normalize price from `amountInDecimals` to `oneToken`
        if (_amountInDecimals == _baseDecimals) {
            normalizedPrice = _price;
        }
        else if (_amountInDecimals < _baseDecimals) {
            normalizedPrice = _price * (10 ** (_baseDecimals - _amountInDecimals));
        } else {
            normalizedPrice = _price / (10 ** (_amountInDecimals - _baseDecimals));
        }

        // normalize price to 18 decimals
        if (_quoteDecimals == _DECIMALS) {
            // price OK
        } else if (_quoteDecimals > _DECIMALS) {
            normalizedPrice /= 10 ** (_quoteDecimals - _DECIMALS);
        } else {
            normalizedPrice *= 10 ** (_DECIMALS - _quoteDecimals);
        }
    }
}
