import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { REGISTRY, STAKING_BANK_STATIC, UMBRELLA_FEEDS } from '../../constants';
import { verifyCode } from '../../scripts/utils/verifyContract';
import { umbrellaFeedsDeploymentData } from '../deploymentsData/umbrellaFeeds';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const { args, contractName } = await umbrellaFeedsDeploymentData(hre);

  const stakingBank = await deploy(UMBRELLA_FEEDS, {
    contract: contractName,
    from: deployer,
    log: true,
    args,
    waitConfirmations: 1,
  });

  await verifyCode(hre, stakingBank.address, args);
};

func.dependencies = [REGISTRY, STAKING_BANK_STATIC];
func.tags = [UMBRELLA_FEEDS];
export default func;
