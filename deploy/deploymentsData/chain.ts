import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { CHAIN, networks } from '../../constants';
import { DeploymentData } from '../_helpers/types';
import { resolveRegistry } from '../../tasks/_helpers/resolveRegistry';

type ChainArgs = {
  contractRegistry: string;
  padding: number;
  requiredSignatures: number;
  allowForMixedType: boolean;
};

const deploymentData = (chainArgs: ChainArgs): DeploymentData => {
  return {
    args: Object.values(chainArgs),
    contractName: CHAIN,
  };
};

export const chainDeploymentData = async (hre: HardhatRuntimeEnvironment): Promise<DeploymentData> => {
  const registry = await resolveRegistry(hre);

  let padding: number;
  let requiredSignatures: number;
  let allowForMixedType: boolean;

  switch (hre.network.name) {
    case networks.LOCALHOST:
    case networks.HARDHAT:
    case networks.BSC_STAGING:
      padding = 60;
      requiredSignatures = 1;
      allowForMixedType = false; // !!process.env.ALLOW_FOR_MIXED_TYPE
      break;

    default:
      throw Error(`missing ${hre.network.name} settings for ${CHAIN}`);
  }

  return deploymentData({
    contractRegistry: registry.address,
    padding,
    requiredSignatures,
    allowForMixedType,
  });
};
