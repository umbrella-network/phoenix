import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Contract } from 'ethers';

import { REGISTRY } from '../../constants';
import configuration from '../../config';

// we need a way to fetch registry from old config and new deployments
export const resolveRegistry = async (hre: HardhatRuntimeEnvironment): Promise<Contract> => {
  const { ethers, artifacts } = hre;

  try {
    const registryDeployments = await hre.deployments.get(REGISTRY);
    return new ethers.Contract(registryDeployments.address, registryDeployments.abi, hre.ethers.provider);
  } catch (e) {
    console.warn((<Error>e).message);
    console.log(`fetching ${REGISTRY} address from old config`);
  }

  const config = configuration(hre.network.name.split('_')[1]);
  const Registry = artifacts.readArtifactSync(REGISTRY);
  console.log(`registry from config: ${config.contractRegistry.address}`);

  return new ethers.Contract(config.contractRegistry.address, Registry.abi, hre.ethers.provider);
};
