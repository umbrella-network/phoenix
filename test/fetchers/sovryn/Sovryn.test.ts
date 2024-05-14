import 'hardhat';
import '@nomiclabs/hardhat-ethers';

import hre from 'hardhat';
import { expect, use } from 'chai';
import {BigNumber, Contract} from 'ethers';
import { waffleChai } from '@ethereum-waffle/chai';
import fs from 'fs';

import { forkToNet } from '../../../scripts/utils/forkToNet';

use(waffleChai);

describe('Sovryn', () => {
  const SovrynSwapNetworkAddress = '0x98ace08d2b759a265ae326f010496bcd63c15afc';
  const rUSDT = '0xef213441a85df4d7acbdae0cf78004e1e486bb96';
  const weBTC = '0x542fda317318ebf1d3deaf76e0b632741a7e677d';

  let contract: Contract;

  before(async () => {
    await forkToNet(hre, 'rootstock_production', 6342497);
    const abi = fs.readFileSync(__dirname + '/SovrynSwapNetwork.abi.json', 'utf-8');
    contract = new Contract(SovrynSwapNetworkAddress, abi, hre.ethers.provider);
  });

  it('#conversionPath', async () => {
    const result: string[] = await contract.callStatic.conversionPath(weBTC, rUSDT);
    console.log(result);

    expect(result.length).gt(0);
  });

  it.only('#rateByPath 1weBTC = ? USDT', async () => {
    const path: string[] = await contract.callStatic.conversionPath(weBTC, rUSDT);

    // const path = [
    //   '0x542fDA317318eBF1d3DEAf76E0b632741A7e677d',
    //   '0x30a9B9bE9Aa8Fd64ee43B1B6c9bD474601373D34',
    //   '0xef213441A85dF4d7ACbDaE0Cf78004e1E486bB96',
    // ];

    // TODO fetch tokens decimals
    const one = 10n ** 18n;
    const result: BigNumber = await contract.callStatic.rateByPath(path, BigInt(one));
    console.log(hre.ethers.utils.formatUnits(result, 18));

    expect(result.div(one).toNumber()).closeTo(62388, 1.0);
  });

  it.only('#rateByPath weBTC/USDT', async () => {
    const path: string[] = await contract.callStatic.conversionPath(weBTC, rUSDT);
    const one = 1e8;
    const result: BigNumber = await contract.callStatic.rateByPath(path, BigInt(one));
    console.log(hre.ethers.utils.formatUnits(result, 9));

    expect(result.div(one).toNumber()).closeTo(62388, 1.0);
  });
});
