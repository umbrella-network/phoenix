import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { REGISTRY, UMBRELLA_FEEDS } from '../../constants';
import { DeploymentData } from '../_helpers/types';
import { HARDHAT, LOCALHOST } from '../../constants/networks';

type UmbrellaFeedsArgs = {
  contractRegistry: string;
  requiredSignatures: number;
  decimals: number;
};

const deploymentData = (network: string, umbrellaFeedsArgs: UmbrellaFeedsArgs): DeploymentData => {
  console.log(Object.values(umbrellaFeedsArgs));

  let contractName = `contracts/onChainFeeds/UmbrellaFeeds.sol:${UMBRELLA_FEEDS}`;

  if (network.startsWith('zk_link_nova')) {
    contractName = `contracts/onChainFeeds/zk-link/UmbrellaFeeds.sol:${UMBRELLA_FEEDS}`;
  }

  return {
    args: Object.values(umbrellaFeedsArgs),
    contractName,
  };
};

const requiredSignatures = (hre: HardhatRuntimeEnvironment): number => {
  if ([LOCALHOST, HARDHAT].includes(hre.network.name)) {
    return 1;
  }

  if (hre.network.name.includes('_staging')) {
    return 2;
  }

  if (hre.network.name.includes('_sandbox')) {
    return 2;
  }

  return 6;
};

export const umbrellaFeedsDeploymentData = async (hre: HardhatRuntimeEnvironment): Promise<DeploymentData> => {
  const { deployments } = hre;
  const decimals = 8;
  const registry = await deployments.get(REGISTRY);

  return deploymentData(hre.network.name, {
    contractRegistry: registry.address,
    requiredSignatures: requiredSignatures(hre),
    decimals,
  });
};
