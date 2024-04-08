import hre, { artifacts, ethers } from 'hardhat';
import { Contract } from 'ethers';

import configuration from '../../config';

const config = configuration();
const provider = hre.ethers.provider;

const Registry = artifacts.readArtifactSync('Registry');
const StakingBank = artifacts.readArtifactSync('IStakingBank');
const Chain = artifacts.readArtifactSync('Chain');
const Token = artifacts.readArtifactSync('Token');

export const deployedRegistry = async (): Promise<Contract> => {
  return new ethers.Contract(config.contractRegistry.address, Registry.abi, provider).connect(
    (await ethers.getSigners())[0],
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
    default:
      throw Error(`${name} not deployed`);
  }

  return new ethers.Contract(address, abi, provider).connect((await ethers.getSigners())[0]);
};
