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
      padding = 60;
      requiredSignatures = 1;
      allowForMixedType = false;
      break;

    case networks.POLYGON_STAGING:
    case networks.POLYGON_SANDBOX:
    case networks.AVALANCHE_STAGING:
    case networks.AVALANCHE_SANDBOX:
    case networks.ARBITRUM_STAGING:
    case networks.ARBITRUM_SANDBOX:
      padding = 180;
      requiredSignatures = 2;
      allowForMixedType = false; // !!process.env.ALLOW_FOR_MIXED_TYPE
      break;

    case networks.BNB_STAGING:
      padding = 240;
      requiredSignatures = 2;
      allowForMixedType = false;
      break;

    case networks.BNB_SANDBOX:
      padding = 240;
      requiredSignatures = 2;
      allowForMixedType = false;
      break;

    case networks.BNB_PRODUCTION:
      padding = 240;
      requiredSignatures = 6;
      allowForMixedType = false;
      break;

    case networks.ARBITRUM_PRODUCTION:
      padding = 60 * 60 * 6; // 6h
      requiredSignatures = 6;
      allowForMixedType = false;
      break;

    case networks.AVALANCHE_PRODUCTION:
      padding = 1800;
      requiredSignatures = 6;
      allowForMixedType = false;
      break;

    case networks.ETH_PRODUCTION:
      padding = 65535;
      requiredSignatures = 6;
      allowForMixedType = false;
      break;

    case networks.POLYGON_PRODUCTION:
      padding = 60;
      requiredSignatures = 6;
      allowForMixedType = false;
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
