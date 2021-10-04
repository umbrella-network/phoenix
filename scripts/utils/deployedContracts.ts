import { ethers } from 'hardhat';
import { Contract } from 'ethers';

import configuration from '../../config';
import { getProvider } from './helpers';

const config = configuration();
const provider = getProvider();

import Registry from '../../artifacts/contracts/Registry.sol/Registry.json';
import StakingBank from '../../artifacts/contracts/StakingBank.sol/StakingBank.json';
import Chain from '../../artifacts/contracts/Chain.sol/Chain.json';
import Token from '../../artifacts/contracts/Token.sol/Token.json';

export const deployedRegistry = async (): Promise<Contract> => {
  return new ethers.Contract(config.contractRegistry.address, Registry.abi, provider).connect(
    (await ethers.getSigners())[0]
  );
};

export const deployedContract = async (name: 'StakingBank' | 'UMB' | 'Chain'): Promise<Contract> => {
  const address = await (await deployedRegistry()).getAddressByString(name);
  let abi;

  switch (name) {
    case 'StakingBank':
      abi = StakingBank.abi;
      break;
    case 'Chain':
      abi = Chain.abi;
      break;
    case 'UMB':
      abi = Token.abi;
      break;
  }

  return new ethers.Contract(address, abi, provider).connect((await ethers.getSigners())[0]);
};
