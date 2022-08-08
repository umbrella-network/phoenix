import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { STAKING_BANK, REGISTRY } from '../../constants';
import { DeploymentData } from '../_helpers/types';

type StakingBankArgs = {
  contractRegistry: string;
  minAmountForStake: bigint;
  name: string;
  symbol: string;
};

const deploymentData = (stakingBankArgs: StakingBankArgs): DeploymentData => {
  console.log(Object.values(stakingBankArgs));

  return {
    args: Object.values(stakingBankArgs),
    contractName: STAKING_BANK,
  };
};

export const stakingBankDeploymentData = async (hre: HardhatRuntimeEnvironment): Promise<DeploymentData> => {
  const { deployments } = hre;
  const decimals = 10n ** 18n;

  const registry = await deployments.get(REGISTRY);
  const minAmountForStake = 100n * decimals;

  return deploymentData({
    contractRegistry: registry.address,
    minAmountForStake,
    name: 'UMB token',
    symbol: 'UMB',
  });
};
