import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { REGISTRY, UMBRELLA_FEEDS, UMBRELLA_FEEDS_READER_FACTORY } from '../../constants';
import { verifyCode } from '../../scripts/utils/verifyContract';
import { checkStakingBankStaticUpdated } from '../_helpers/checkStakingBankStaticUpdated';
import { onChainSupportedBlockchains } from '../_helpers/onChainSupportedBlockchains';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (!onChainSupportedBlockchains(hre)) {
    console.log('-'.repeat(80));
    console.log(`${UMBRELLA_FEEDS_READER_FACTORY} is not supported on ${hre.network.name}`);
    console.log('-'.repeat(80));
    return;
  }

  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // check if we are using newest staking bank
  if (!(await checkStakingBankStaticUpdated(hre))) {
    return;
  }

  const registry = await deployments.get(REGISTRY);
  const args = [registry.address];
  const readerFactory = await deploy(UMBRELLA_FEEDS_READER_FACTORY, {
    from: deployer,
    log: true,
    args,
    waitConfirmations: 1,
  });

  await verifyCode(hre, readerFactory.address, args);
};

func.dependencies = [UMBRELLA_FEEDS];
func.tags = [UMBRELLA_FEEDS_READER_FACTORY];
export default func;
