import 'hardhat';
import '@nomiclabs/hardhat-ethers';

import hre from 'hardhat';
import { expect, use } from 'chai';
import { Contract } from 'ethers';
import { waffleChai } from '@ethereum-waffle/chai';

import { forkToNet } from '../../scripts/utils/forkToNet';
import { UNISWAPV3_FETCHER_HELPER } from '../../constants';
import { resolveContract } from '../../scripts/utils/helpers';
import { UniswapV3FetcherHelper } from '../../typechain';

import PriceDataStruct = UniswapV3FetcherHelper.PriceDataStruct;

use(waffleChai);

describe.skip('UniswapV3FetchersHelpers', () => {
  const USDC_ETH_POOL_1 = '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640';
  const USDC_ETH_POOL_2 = '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8';
  const WBTC_USDC_POOL = '0x99ac8ca7087fa4a2a1fb6357269965a2014abc35';
  const WBTC_USDT_POOL = '0x9db9e0e53058c89e5b94e29621a205198648425b';
  const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  const WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';

  const WETH_PRICE_FROM_BIGGEST_POOL = 3530445979000000000000n;

  let contract: Contract;

  before(async () => {
    await forkToNet(hre, 'eth_production', 19639290);
    const [signer] = await hre.ethers.getSigners();

    await hre.deployments.fixture([UNISWAPV3_FETCHER_HELPER], {
      fallbackToGlobal: false,
    });

    contract = await resolveContract(hre, UNISWAPV3_FETCHER_HELPER, signer);
  });

  it('no data', async () => {
    const [[result]] = await contract.callStatic.getPrices([]);

    expect(result).undefined;
  });

  it('no pools', async () => {
    const data: PriceDataStruct[] = [
      <PriceDataStruct>{
        pools: [],
        base: WBTC,
        quote: USDC,
      },
    ];

    console.log(data);
    console.log(contract.address);

    const [[result]] = await contract.callStatic.getPrices(data);

    expect(result.success).false;
  });

  it('ETH-USDC with invalid base', async () => {
    const data: PriceDataStruct[] = [
      <PriceDataStruct>{
        pools: [USDC_ETH_POOL_1],
        base: WBTC,
        quote: USDC,
      },
    ];

    const [[result]] = await contract.callStatic.getPrices(data);

    expect(result.success).false;
  });

  it('ETH-USDC with invalid quote', async () => {
    const data: PriceDataStruct[] = [
      <PriceDataStruct>{
        pools: [USDC_ETH_POOL_1],
        base: USDC,
        quote: WBTC,
      },
    ];

    const [[result]] = await contract.callStatic.getPrices(data);

    expect(result.success).false;
  });

  it('base - no decimals', async () => {
    const data: PriceDataStruct[] = [
      <PriceDataStruct>{
        pools: [USDC_ETH_POOL_1],
        base: USDC,
        quote: hre.ethers.constants.AddressZero,
      },
    ];

    const [[result]] = await contract.callStatic.getPrices(data);

    expect(result.success).false;
  });

  it('quote - no decimals', async () => {
    const data: PriceDataStruct[] = [
      <PriceDataStruct>{
        pools: [USDC_ETH_POOL_1],
        base: hre.ethers.constants.AddressZero,
        quote: USDC,
      },
    ];

    const [[result]] = await contract.callStatic.getPrices(data);

    expect(result.success).false;
  });

  it('base - not a token', async () => {
    const data: PriceDataStruct[] = [
      <PriceDataStruct>{
        pools: [USDC_ETH_POOL_1],
        base: USDC,
        quote: hre.ethers.constants.AddressZero.replace('0x0', '0x1'),
      },
    ];

    const [[result]] = await contract.callStatic.getPrices(data);

    expect(result.success).false;
  });

  it('quote - not a token', async () => {
    const data: PriceDataStruct[] = [
      <PriceDataStruct>{
        pools: [USDC_ETH_POOL_1],
        base: hre.ethers.constants.AddressZero.replace('0x000', '0x111'),
        quote: USDC,
      },
    ];

    const [[result]] = await contract.callStatic.getPrices(data);

    expect(result.success).false;
  });

  it('tokensSymbols', async () => {
    const symbols = await contract.tokensSymbols([USDC, WBTC, WETH]);

    expect(symbols[0]).eq('USDC');
    expect(symbols[1]).eq('WBTC');
    expect(symbols[2]).eq('WETH');
  });

  it('USDC-ETH price', async () => {
    const data: PriceDataStruct[] = [
      <PriceDataStruct>{
        pools: [USDC_ETH_POOL_1],
        base: USDC,
        quote: WETH, // how much WETH I will grt for 1 base token
      },
    ];

    const [[result], timestamp] = await contract.callStatic.getPrices(data);

    expect(timestamp).eq(1712922025, 'block timestamp');
    expect(result.price).eq('282966776790952', 'price of 1 USDC in WETH');
  });

  it('USDC_ETH_POOL_1 price', async () => {
    const data: PriceDataStruct[] = [
      <PriceDataStruct>{
        pools: [USDC_ETH_POOL_1],
        base: WETH,
        quote: USDC,
      },
    ];

    const [[result], timestamp] = await contract.callStatic.getPrices(data);

    console.log(BigInt(result.price.toString()));
    console.log(BigInt(timestamp.toString()));
    console.log(result.success);

    expect(timestamp).eq(1712922025, 'block timestamp');
    expect(result.price).eq(WETH_PRICE_FROM_BIGGEST_POOL, 'price of 1 ETH in USDC (in 18 decimals)');
  });

  it('USDC_ETH_POOL_2 price', async () => {
    const data: PriceDataStruct[] = [
      <PriceDataStruct>{
        pools: [USDC_ETH_POOL_2],
        base: WETH,
        quote: USDC,
      },
    ];

    const [[result], timestamp] = await contract.callStatic.getPrices(data);

    expect(timestamp).eq(1712922025, 'block timestamp');
    expect(result.price).eq('3519129217000000000000', 'price of 1 ETH in USDC (in 18 decimals)');
    expect(result.price).not.eq(WETH_PRICE_FROM_BIGGEST_POOL, 'price is different on other pool');
  });

  it('integration example for pegasus', async () => {
    // contract.address - is helper address in hex form 0x...
    // contract.interface is ABI `UniswapV3FetcherHelper.json`
    // hre.ethers.provider is provider, make sure you using StaticJsonRpcProvider!
    const fetcher = new Contract(contract.address, contract.interface, hre.ethers.provider);

    const inputData: PriceDataStruct[] = [
      <PriceDataStruct>{
        pools: [USDC_ETH_POOL_1, USDC_ETH_POOL_2],
        base: WETH,
        quote: USDC,
      },
      <PriceDataStruct>{
        pools: [WBTC_USDT_POOL],
        base: WBTC,
        quote: USDT,
      },
      <PriceDataStruct>{
        pools: [WBTC_USDC_POOL],
        base: WBTC,
        quote: USDT,
      },
    ];

    const [results, timestamp] = await fetcher.callStatic.getPrices(inputData);

    expect(timestamp).eq(1712922025, 'this should be price timestamp');

    expect(results[0].success).true;
    expect(results[0].price).eq(WETH_PRICE_FROM_BIGGEST_POOL, 'price of 1 wETH in USDC (in 18 decimals)');

    expect(results[1].success).true;
    expect(results[1].price).eq('70544474998000000000000', 'price of 1 wBTC in USDT (in 18 decimals)');

    expect(results[2].success).false;
    expect(results[2].price).eq('0', 'this price should not be used even if not 0, because success==FALSE');
  });
});
