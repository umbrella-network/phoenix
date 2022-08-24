import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { CHAIN, REGISTRY } from '../../constants';
import { HARDHAT } from '../../constants/networks';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy, read } = deployments;
  const [deployer] = await hre.ethers.getSigners();

  const canDeploy = [HARDHAT].includes(hre.network.name);

  if (canDeploy) {
    await deploy(REGISTRY, { from: deployer.address, log: true, waitConfirmations: 1 });
  } else {
    try {
      const registry = await deployments.get(REGISTRY);
      console.log(`Registry exists at ${registry.address}`);

      const bytes32 = await read(REGISTRY, 'stringToBytes32', CHAIN);

      if (bytes32 != '0x436861696e000000000000000000000000000000000000000000000000000000') {
        throw new Error(`sanity check failed: ${bytes32}`);
      }
    } catch (e) {
      console.log(e);

      throw Error(`we can't deploy new registry, but we need file with deployment address for: ${hre.network.name}`);
    }
  }
};

func.tags = [REGISTRY];
export default func;
