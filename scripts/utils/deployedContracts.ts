require('custom-env').env(); // eslint-disable-line

import {ethers} from 'hardhat';
import {Contract} from 'ethers';

import configuration from '../../config';
import {getProvider} from './helpers';

const config = configuration();
const provider = getProvider();

import Registry from '../../artifacts/contracts/Registry.sol/Registry.json';
import StakingBank from '../../artifacts/contracts/StakingBank.sol/StakingBank.json';
import ValidatorRegistry from '../../artifacts/contracts/ValidatorRegistry.sol/ValidatorRegistry.json';
import Token from '../../artifacts/contracts/Token.sol/Token.json';

export const deployedRegistry = async (): Promise<Contract> => {
  return new ethers.Contract(config.contractRegistry.address, Registry.abi, provider)
    .connect((await ethers.getSigners())[0]);
};

export const deployedContract = async (
  name: 'StakingBank' | 'ValidatorRegistry' | 'Token'
): Promise<Contract> => {
  const address = (await deployedRegistry()).getAddressByString(name);
  let abi;

  switch (name) {
  case 'ValidatorRegistry':
    abi = ValidatorRegistry.abi;
    break;
  case 'StakingBank':
    abi = StakingBank.abi;
    break;
  case 'Token':
    abi = Token.abi;
    break;
  }

  return new ethers.Contract(address, abi, provider).connect((await ethers.getSigners())[0]);
};
