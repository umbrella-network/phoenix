import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { CHAIN, CHAIN_BYTES32, REGISTRY } from '../../constants';
import { HARDHAT, LOCALHOST } from '../../constants/networks';
import { verifyCode } from '../../scripts/utils/verifyContract';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy, read } = deployments;
  const [deployer] = await hre.ethers.getSigners();

  if ([HARDHAT, LOCALHOST].includes(hre.network.name)) {
    console.log(`deploying Registry on ${hre.network.name} (${await hre.getChainId()})`);
    const registry = await deploy(REGISTRY, { from: deployer.address, log: true, waitConfirmations: 1 });
    await verifyCode(hre, registry.address, []);
    return;
  }

  try {
    const registry = await deployments.get(REGISTRY);
    console.log(`Registry exists at ${registry.address}`);

    const bytes32 = await read(REGISTRY, 'stringToBytes32', CHAIN);

    if (bytes32 != CHAIN_BYTES32) {
      throw new Error(`sanity check failed: ${bytes32}`);
    }

    console.log('sanity check', CHAIN, bytes32);
  } catch (e) {
    console.log(e);

    throw Error(`we can't deploy new registry, but we need file with deployment address for: ${hre.network.name}`);
  }
};

func.tags = [REGISTRY];
export default func;
