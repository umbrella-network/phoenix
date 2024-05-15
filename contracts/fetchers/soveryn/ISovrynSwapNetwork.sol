// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

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
