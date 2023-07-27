import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import fs from 'fs';

import { REGISTRY, STAKING_BANK_STATIC, UMBRELLA_FEEDS } from '../../constants';
import { verifyCode } from '../../scripts/utils/verifyContract';
import { umbrellaFeedsDeploymentData } from '../deploymentsData/umbrellaFeeds';
import { checkStakingBankStaticUpdated } from '../_helpers/checkStakingBankStaticUpdated';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  return;

  const { deployments, getNamedAccounts } = hre;
  const { deploy, read } = deployments;
  const { deployer } = await getNamedAccounts();

  const { args, contractName } = await umbrellaFeedsDeploymentData(hre);

  // check if we are using newest staking bank
  if (!(await checkStakingBankStaticUpdated(hre))) {
    return;
  }

  const f = `${__dirname}/../deployments/${hre.network.name}/${UMBRELLA_FEEDS}.json`;

  if (fs.existsSync(f)) {
    const [bankInFees, recentBank] = await Promise.all([
      read(UMBRELLA_FEEDS, 'STAKING_BANK'),
      deployments.get(STAKING_BANK_STATIC),
    ]);

    if (bankInFees.toLowerCase() == recentBank.address.toLowerCase()) {
      console.log(`${UMBRELLA_FEEDS} has current bank ${recentBank.address} - OK`);
    } else {
      console.log('new bank detected - deploying...');
      const f = `${__dirname}/../deployments/${hre.network.name}/${UMBRELLA_FEEDS}.json`;
      console.log('new bank detected - deploying...', f);
      fs.unlinkSync(f);
    }
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
