import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { REGISTRY } from '../../constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy } = deployments;
  const [deployer] = await hre.ethers.getSigners();

  await deploy(REGISTRY, { from: deployer.address, log: true, waitConfirmations: 1 });
};

func.tags = [REGISTRY];
export default func;
