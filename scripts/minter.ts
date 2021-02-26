import hre, {ethers} from 'hardhat';
import configuration from '../config';
import Registry from '../artifacts/contracts/Registry.sol/Registry.json';
import Chain from '../artifacts/contracts/Chain.sol/Chain.json';
import {getProvider} from './utils/helpers';
import {Contract} from 'ethers';

const web3 = hre.web3;

const provider = getProvider();

const registry = new hre.ethers.Contract(configuration().contractRegistry.address, Registry.abi, provider);

let chain: Contract;

const mineBlock = async () => {
  await ethers.provider.send('evm_mine', []);

  const bn = await web3.eth.getBlockNumber();
  let blockHeight;

  if (chain) {
    blockHeight = await chain.getBlockHeight();
  }

  console.log('ETH block number: ', bn, 'blockHeight: ', blockHeight.toString());
};

const minting = async (blockTime: string | undefined) => {
  if (!blockTime) {
    throw Error('please setup .env with `LOCAL_BLOCK_TIME`.');
  }

  chain = new hre.ethers.Contract(await registry.getAddressByString('Chain'), Chain.abi, provider);

  console.log(`start minting blocks every ${blockTime} sec... CTRL+C to stop`);
  setInterval(mineBlock, parseInt(blockTime, 10) * 1000);
};

minting(process.env.LOCAL_BLOCK_TIME)
  .then()
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
