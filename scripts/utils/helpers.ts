require('custom-env').env(); // eslint-disable-line

import hre from 'hardhat';
import { HttpNetworkUserConfig } from 'hardhat/types';
import { ethers } from 'ethers';
import '@nomiclabs/hardhat-web3';
import { Provider } from '@ethersproject/providers';

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const constructorAbi = (types: string[], values: any[]): string => {
  return ethers.utils.defaultAbiCoder.encode(types, values).replace('0x', '');
};

export const isLocalNetwork = (): boolean => ['buidlerevm', 'localhost', 'docker'].includes(hre.network.name);

export const getProvider = (): Provider => {
  return new ethers.providers.JsonRpcProvider((<HttpNetworkUserConfig>hre.config.networks[hre.network.name]).url);
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

export const pressToContinue = (charToPress = 'y', callback: () => void): void => {
  console.log('-'.repeat(80));
  console.log(`\n\n\nCHECK IF NETWORK IS VALID, do you want to continue? (${charToPress})\n\n\n`);
  console.log('-'.repeat(80));

  const stdin = process.stdin;

  // without this, we would only get streams once enter is pressed
  stdin.setRawMode(true);

  // resume stdin in the parent process (node app won't quit all by itself
  // unless an error or process.exit() happens)
  stdin.resume();
  // i don't want binary, do you?
  stdin.setEncoding('utf8');

  // on any data into stdin
  stdin.on('data', function (key) {
    console.log({ key });
    stdin.setRawMode(false);

    // ctrl-c ( end of text )
    if (key.toString() === '\u0003' || key.toString().toLowerCase() !== charToPress.toLowerCase()) {
      process.exit();
    }

    if (key.toString().slice(0, 1).toLowerCase() !== charToPress.toLowerCase()) {
      process.exit();
    }

    // write the key to stdout all normal like
    // process.stdout.write( key );
    callback();
  });
};
