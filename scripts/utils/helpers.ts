require('custom-env').env(); // eslint-disable-line

import hre from 'hardhat';
import {HttpNetworkUserConfig} from 'hardhat/types';
import {ethers} from 'ethers';
import '@nomiclabs/hardhat-web3';
import {Provider} from '@ethersproject/providers';

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const constructorAbi = (types: string[], values: any[]): string => {
  return ethers.utils.defaultAbiCoder.encode(types, values).replace('0x', '');
};

export const isLocalNetwork = (): boolean => ['buidlerevm', 'localhost', 'docker'].includes(hre.network.name);

export const isDockerNetwork = (): boolean => ['docker'].includes(hre.network.name);

export const getProvider = (): Provider => {
  if (isLocalNetwork() && !isDockerNetwork()) {
    return new ethers.providers.WebSocketProvider('ws://localhost:8545');
  } else {
    return new ethers.providers.JsonRpcProvider((<HttpNetworkUserConfig>hre.config.networks[hre.network.name]).url);
  }
};

export const waitForTx = async (txHash: string, provider: Provider): Promise<void> => {
  if (hre.network.name === 'buidlerevm') {
    return;
  }

  console.log('waiting for tx to be mined...', txHash);
  const receipt = await provider.waitForTransaction(txHash);

  if (receipt.status !== 1) {
    console.log(receipt);
    throw Error('rejected tx');
  }

  console.log('...success');
};

export const toBytes32 = (str: string): string => {
  const bytes = Buffer.from(str).toString('hex');
  return `0x${bytes}${'0'.repeat(64 - bytes.length)}`;
};
