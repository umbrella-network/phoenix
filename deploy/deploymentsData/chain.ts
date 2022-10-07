import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { CHAIN, FOREIGN_CHAIN, networks, REGISTRY } from '../../constants';
import { DeploymentData } from '../_helpers/types';
import { isMasterChain } from '../../constants/networks';

type ChainArgs = {
  contractRegistry: string;
  padding: number;
  requiredSignatures: number;
  allowForMixedType: boolean;
};

const deploymentData = async (hre: HardhatRuntimeEnvironment, chainArgs: ChainArgs): Promise<DeploymentData> => {
  return {
    args: Object.values(chainArgs),
    contractName: isMasterChain(await hre.getChainId()) ? CHAIN : FOREIGN_CHAIN,
  };
};

export const chainDeploymentData = async (hre: HardhatRuntimeEnvironment): Promise<DeploymentData> => {
  const registry = await hre.deployments.get(REGISTRY);

  let padding: number;
  let requiredSignatures: number;
  let allowForMixedType: boolean;

  switch (hre.network.name) {
    case networks.LOCALHOST:
    case networks.HARDHAT:
    case networks.BSC_STAGING:
    case networks.POLYGON_STAGING:
    case networks.AVALANCHE_STAGING:
      padding = 60;
      requiredSignatures = 1;
      allowForMixedType = false; // !!process.env.ALLOW_FOR_MIXED_TYPE
      break;

    default:
      throw Error(`missing ${hre.network.name} settings for ${CHAIN}, copy them from old config.`);
  }

  return deploymentData(hre, {
    contractRegistry: registry.address,
    padding,
    requiredSignatures,
    allowForMixedType,
  });
};
