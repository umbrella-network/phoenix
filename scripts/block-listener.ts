import {ethers} from 'hardhat';
import Chain from '../artifacts/contracts/Chain.sol/Chain.json';
import {getProvider} from './utils/helpers';

import {BigNumber} from 'ethers';
import configuration from '../config';
import Registry from '../artifacts/contracts/Registry.sol/Registry.json';

async function main() {
  const provider = getProvider();

  const registry = new ethers.Contract(configuration().contractRegistry.address, Registry.abi, provider);
  const chain = new ethers.Contract(await registry.getAddressByString('Chain'), Chain.abi, provider);

  console.log('blockPadding:', (await chain.blockPadding()).toString());
  console.log('blockHeight:', (await chain.getBlockHeight()).toString());

  chain.on('LogMint', (sender: string, blockHeight: BigNumber, blockNumber: BigNumber) => {
    console.log('LogMint:', sender, blockHeight, blockNumber);
    chain.blocks(blockHeight.toString()).then(console.log);
  });

  console.log('watching for mined blocks...');
}

main().then().catch(console.log);
