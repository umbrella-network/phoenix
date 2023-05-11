import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { REGISTRY, UMBRELLA_FEEDS, UMBRELLA_FEEDS_READER_FACTORY } from '../../constants';
import { verifyCode } from '../../scripts/utils/verifyContract';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

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
