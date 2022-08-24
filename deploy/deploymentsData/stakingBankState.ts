import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { REGISTRY, STAKING_BANK_STATE } from '../../constants';
import { DeploymentData } from '../_helpers/types';

type StakingBankStateArgs = {
  contractRegistry: string;
};

const deploymentData = (stakingBankArgs: StakingBankStateArgs): DeploymentData => {
  console.log(Object.values(stakingBankArgs));

  return {
    args: Object.values(stakingBankArgs),
    contractName: STAKING_BANK_STATE,
  };
};

export const stakingBankStateDeploymentData = async (hre: HardhatRuntimeEnvironment): Promise<DeploymentData> => {
  const { deployments } = hre;

  const registry = await deployments.get(REGISTRY);

  return deploymentData({ contractRegistry: registry.address });
};
