import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { REGISTRY, STAKING_BANK_STATIC, UMBRELLA_FEEDS } from '../../constants';
import { verifyCode } from '../../scripts/utils/verifyContract';
import { umbrellaFeedsDeploymentData } from '../deploymentsData/umbrellaFeeds';
import { checkStakingBankStaticUpdated } from '../_helpers/checkStakingBankStaticUpdated';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const { args, contractName } = await umbrellaFeedsDeploymentData(hre);

  // check if we are using newest staking bank
  if (!(await checkStakingBankStaticUpdated(hre))) {
    return;
  }

  const feeds = await deploy(UMBRELLA_FEEDS, {
    contract: contractName,
    from: deployer,
    log: true,
    args,
    waitConfirmations: 1,
  });

  await verifyCode(hre, feeds.address, args);
};

func.dependencies = [REGISTRY, STAKING_BANK_STATIC];
func.tags = [UMBRELLA_FEEDS];
export default func;
