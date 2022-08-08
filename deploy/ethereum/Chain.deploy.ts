import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { CHAIN, REGISTRY, STAKING_BANK } from '../../constants';
import { chainDeploymentData } from '../deploymentsData';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, read, execute } = deployments;
  const { deployer } = await getNamedAccounts();

  const data = await chainDeploymentData(hre);
  const chain = await deploy(CHAIN, { from: deployer, log: true, args: data.args, waitConfirmations: 1 });

  const registryOwner = await read(REGISTRY, 'owner');

  if (registryOwner.toLowerCase() != deployer.toLowerCase()) {
    console.log('importing chain address to registry not possible - not an owner');
    return;
  }

  const inRegistry = await read(REGISTRY, 'getAddressByString', CHAIN);

  if (inRegistry != chain.address) {
    const method = inRegistry == hre.ethers.constants.AddressZero ? 'importContracts' : 'atomicUpdate';

    console.log('importing chain address to registry using:', method);

    await execute(
      REGISTRY,
      {
        from: deployer,
        log: true,
        waitConfirmations: 1,
      },
      method,
      [chain.address]
    );
  } else {
    console.log(`${CHAIN} already registered`);
  }
};

func.dependencies = [REGISTRY, STAKING_BANK];
func.tags = [CHAIN];
export default func;
