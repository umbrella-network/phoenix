import 'hardhat';
import '@nomiclabs/hardhat-ethers';

import hre from 'hardhat';
import { expect, use } from 'chai';
import { BigNumber, Contract } from 'ethers';
import { waffleChai } from '@ethereum-waffle/chai';
import fs from 'fs';

import { forkToNet } from '../../../scripts/utils/forkToNet';
import { resolveContract, toBytes32 } from '../../../scripts/utils/helpers';
import { SOVERYN_FETCHER_HELPER } from '../../../constants';

use(waffleChai);

describe('Sovryn', () => {
  const SovrynSwapNetworkAddress = '0x98ace08d2b759a265ae326f010496bcd63c15afc';
  const rUSDT = '0xef213441a85df4d7acbdae0cf78004e1e486bb96';
  const weBTC = '0x542fda317318ebf1d3deaf76e0b632741a7e677d';

  let sovrynSwapNetwork: Contract;
  let sovrynFetcherHelper: Contract;

  before(async () => {
    // tests number were checked with https://alpha.sovryn.app/swap on block 6343774
    await forkToNet(hre, 'rootstock_production', 6343774);

    const [signer] = await hre.ethers.getSigners();

    const abi = fs.readFileSync(__dirname + '/SovrynSwapNetwork.abi.json', 'utf-8');
    sovrynSwapNetwork = new Contract(SovrynSwapNetworkAddress, abi, hre.ethers.provider);

    await hre.deployments.fixture([SOVERYN_FETCHER_HELPER], {
      fallbackToGlobal: false,
    });

    sovrynFetcherHelper = await resolveContract(hre, SOVERYN_FETCHER_HELPER, signer);
  });

  it('#conversionPath', async () => {
    const result: string[] = await sovrynSwapNetwork.callStatic.conversionPath(weBTC, rUSDT);
    console.log(result);

    expect(result.length).gt(0);
  });

  it.skip('research', async () => {
    /*
    https://wiki.sovryn.com/en/technical-documents/API/ApiDoc
    see section: SovrynSwapNetwork and ConversionPathFinder

    contracts are registered in registry
    registry can be updated, can we fetch it from
    */

    const registry: string = await sovrynSwapNetwork.registry();

    const bytes32 = toBytes32('ConversionPathFinder');
    console.log(bytes32);

    const data =
      hre.ethers.utils.id('addressOf(bytes32)').slice(0, 10) +
      hre.ethers.utils.defaultAbiCoder.encode(['bytes32'], [bytes32]).replace('0x', '');

    console.log({ data });

    const conversionPathFinderData = await hre.ethers.provider.call({
      from: hre.ethers.constants.AddressZero,
      to: registry,
      data,
    });

    const [conversionPathFinderAddr] = hre.ethers.utils.defaultAbiCoder.decode(['address'], conversionPathFinderData);

    console.log(conversionPathFinderAddr);
    const abi = fs.readFileSync(__dirname + '/ConversionPathFinder.abi.json', 'utf-8');
    const conversionPathFinder = new Contract(conversionPathFinderAddr, abi, hre.ethers.provider);

    // const path: string[] = await sovrynSwapNetwork.callStatic.conversionPath(weBTC, rUSDT);
    //
    // // const path = [
    // //   '0x542fDA317318eBF1d3DEAf76E0b632741A7e677d',
    // //   '0x30a9B9bE9Aa8Fd64ee43B1B6c9bD474601373D34',
    // //   '0xef213441A85dF4d7ACbDaE0Cf78004e1E486bB96',
    // // ];
    //
    // // TODO fetch tokens decimals
    // const one = 10n ** 18n;
    // const result: BigNumber = await sovrynSwapNetwork.callStatic.rateByPath(path, BigInt(one));
    // console.log(hre.ethers.utils.formatUnits(result, 18));
    //
    // expect(result.div(one).toNumber()).closeTo(61487, 1.0);
  });

  it.only('#rateByPath 1weBTC = ? USDT', async () => {
    const path: string[] = await sovrynSwapNetwork.callStatic.conversionPath(weBTC, rUSDT);

    // const path = [
    //   '0x542fDA317318eBF1d3DEAf76E0b632741A7e677d',
    //   '0x30a9B9bE9Aa8Fd64ee43B1B6c9bD474601373D34',
    //   '0xef213441A85dF4d7ACbDaE0Cf78004e1E486bB96',
    // ];

    // TODO fetch tokens decimals
    const one = 10n ** 18n;
    const result: BigNumber = await sovrynSwapNetwork.callStatic.rateByPath(path, BigInt(one));
    console.log(hre.ethers.utils.formatUnits(result, 18));

    expect(result.div(one).toNumber()).closeTo(61487, 1.0);

    const result2 = await sovrynFetcherHelper.getPrices([{ base: weBTC, quote: rUSDT, amount: one }]);
    console.log(result2);
    expect(result).eq(result2.prices[0].price);
  });

  it('#rateByPath weBTC/USDT 1e8, because UMB feeds contract is 8 decimals', async () => {
    const path: string[] = await sovrynSwapNetwork.callStatic.conversionPath(weBTC, rUSDT);
    const precision = 10;
    const amountIn = 10 ** precision; // this should be part of config?
    const result: BigNumber = await sovrynSwapNetwork.callStatic.rateByPath(path, BigInt(amountIn));
    console.log('our price:', result.toNumber() / amountIn);

    expect(result.toNumber() / amountIn).closeTo(61697.0, 0.01);
  });

  it.only('integration example for pegasus', async () => {
    // base quote and amountDecimals should be pulled from yaml feeds file
    const amountDecimals = 8;
    const inputData = [{ base: weBTC, quote: rUSDT, amount: 10 ** amountDecimals }];

    const results = await sovrynFetcherHelper.getPrices(inputData);

    console.log('price timestamp', results.timestamp.toNumber());
    console.log('number of fetched prices', results.prices.length);
    const rawPrice = results.prices[0].price.toBigInt();
    console.log('raw price', rawPrice, results.prices[0].success);
    const intPart = rawPrice / BigInt(10 ** amountDecimals);
    // is there better way to convert to float?
    const priceNumber = Number(intPart) + parseFloat(rawPrice.toString().replace(intPart.toString(), '0.'));
    console.log('formated price that should be returned', priceNumber);

    /*
    price timestamp 1715671726
    number of fetched prices 1
    raw price 6169700566041n true
    formated price that should be returned 61697.00566041
     */

    expect(results.prices[0].price.toBigInt()).eq(61697_00566041n);
  });
});