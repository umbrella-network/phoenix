import { HardhatRuntimeEnvironment } from 'hardhat/types';

import {
  STAKING_BANK_STATIC_PROD,
  STAKING_BANK_STATIC_DEV,
  STAKING_BANK_STATIC_LOCAL,
  STAKING_BANK_STATIC_SBX,
} from '../../constants';
import { DeploymentData } from '../_helpers/types';

export const stakingBankStaticDeploymentData = async (hre: HardhatRuntimeEnvironment): Promise<DeploymentData> => {
  let validatorsCount = 1;
  let contractName = STAKING_BANK_STATIC_LOCAL;

  if (hre.network.name.includes('_production')) {
    validatorsCount = 18;
    contractName = STAKING_BANK_STATIC_PROD;
  } else if (hre.network.name.includes('_staging')) {
    validatorsCount = 2;
    contractName = STAKING_BANK_STATIC_DEV;
  } else if (hre.network.name.includes('_sandbox')) {
    validatorsCount = 2;
    contractName = STAKING_BANK_STATIC_SBX;
  }

  return {
    args: [validatorsCount],
    contractName,
  };
};
