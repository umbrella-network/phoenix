import { Contract } from 'ethers';
import { ethers } from 'hardhat';

import { getProvider, isLocalNetwork } from '../utils/helpers';
import { verifyCode } from '../utils/verifyContract';

const provider = getProvider();

export const deployContractRegistry = async (): Promise<Contract> => {
  const { DEPLOYER_PK } = process.env;

  let ownerWallet;

  if (isLocalNetwork()) {
    [ownerWallet] = await ethers.getSigners();
  } else {
    if (!DEPLOYER_PK) {
      throw new Error('please setup DEPLOYER_PK in .env');
    }

    ownerWallet = new ethers.Wallet(DEPLOYER_PK, provider);
  }

  const owner = await ownerWallet.getAddress();
  console.log('DEPLOYING CONTRACT REGISTRY FROM ADDRESS:', owner);

  const RegistryContract = await ethers.getContractFactory('Registry');
  const registry = await RegistryContract.deploy();
  console.log('tx', registry.deployTransaction.hash);
  await registry.deployed();

  console.log('Registry deployed at', registry.address);

  await verifyCode(registry.address, []);
  return registry;
};
