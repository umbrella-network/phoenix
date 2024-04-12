// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;
pragma abicoder v2;

import {QuoterV2} from "gitmodules/uniswap/v3-periphery/contracts/lens/QuoterV2.sol";


contract Quoter is QuoterV2 {
    // in case it is not deployed eg on some testnet, we can deploy ourselves
    constructor(address _factory, address _WETH9) QuoterV2(_factory, _WETH9) {

    }
}
