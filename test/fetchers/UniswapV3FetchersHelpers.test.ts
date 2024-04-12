import 'hardhat';
import '@nomiclabs/hardhat-ethers';

import hre from 'hardhat';
import { expect, use } from 'chai';
import { Contract } from 'ethers';
import { waffleChai } from '@ethereum-waffle/chai';

import { forkToNet } from '../../scripts/utils/forkToNet';
import { UNISWAPV3_FETCHER_HELPER } from '../../constants';
import { resolveContract } from '../../scripts/utils/helpers';
import {UniswapV3FetcherHelper} from '../../typechain';

import PriceDataStruct = UniswapV3FetcherHelper.PriceDataStruct;

use(waffleChai);

describe.only('UniswapV3FetchersHelpers', () => {
  const USDC_ETH_POOL = '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640';
  const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

  let contract: Contract;

  beforeEach(async () => {
    await forkToNet(hre, 'eth_production', 19639290);
    const [signer] = await hre.ethers.getSigners();

    await hre.deployments.fixture([UNISWAPV3_FETCHER_HELPER], {
      fallbackToGlobal: false,
    });

    contract = await resolveContract(hre, UNISWAPV3_FETCHER_HELPER, signer);
  });

  it('USDC-ETH quote', async () => {
    const data: PriceDataStruct = [
      <PriceDataStruct>{
        pools: [USDC_ETH_POOL],
        base: USDC,
        quote: WETH, // how much WETH I will grt for 1 base token
      },
    ];

    const [[result], timestamp] = await contract.callStatic.getPrices(data);

    console.log(BigInt(result.price.toString()));
    console.log(BigInt(timestamp.toString()));
    console.log(result.success);

    expect(timestamp).eq(1712922025, 'block timestamp');
    expect(result.price).eq('282966776790952', 'price of USDC in WETH');
  });

  it('ETH-USDC quote', async () => {
    const data: PriceDataStruct[] = [
      <PriceDataStruct>{
        pools: [USDC_ETH_POOL],
        base: WETH,
        quote: USDC,
      },
    ];

    const [[result], timestamp] = await contract.callStatic.getPrices(data);

    console.log(BigInt(result.price.toString()));
    console.log(BigInt(timestamp.toString()));
    console.log(result.success);

    expect(timestamp).eq(1712922025, 'block timestamp');
    expect(result.price).eq('3530445979000000000000', 'price of ETH in USDC (in 18 decimals)');
  });
});
