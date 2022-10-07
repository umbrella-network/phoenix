import { task } from 'hardhat/config';

import { REGISTRY, STAKING_BANK } from '../constants';
import { StakingBank__factory, Registry__factory } from '../typechain';

task('updateValidator', 'update validator')
  .addParam('id')
  .addParam('location')
  .setAction(async (taskArgs, hre) => {
    console.log({ taskArgs });
    console.log(`NETWORK: ${hre.network.name} (${(await hre.ethers.provider.getNetwork()).chainId})`);
    const [deployerSigner] = await hre.ethers.getSigners();

    const registryDeployments = await hre.deployments.get(REGISTRY);

    const registry = Registry__factory.connect(registryDeployments.address, hre.ethers.provider);
    const bankAddress = await registry.getAddressByString(STAKING_BANK);
    const stakingBank = StakingBank__factory.connect(bankAddress, deployerSigner);

    const tx = await stakingBank.update(taskArgs.id, taskArgs.location);
    console.log('tx', tx.hash);
    await tx.wait(1);

    console.log(await stakingBank.validators(taskArgs.id));
  });
