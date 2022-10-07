import { task } from 'hardhat/config';

import { CHAIN, REGISTRY, STAKING_BANK } from '../constants';
import { Chain__factory, Registry__factory, StakingBank__factory } from '../typechain';

task('debug', 'task for debugging').setAction(async (taskArgs, hre) => {
  console.log({ taskArgs });
  console.log(`NETWORK: ${hre.network.name} (${(await hre.ethers.provider.getNetwork()).chainId})`);

  const registryDeployments = await hre.deployments.get(REGISTRY);

  const registry = Registry__factory.connect(registryDeployments.address, hre.ethers.provider);
  const bankAddress = await registry.getAddressByString(STAKING_BANK);
  const stakingBank = StakingBank__factory.connect(bankAddress, hre.ethers.provider);

  const chainAddress = await registry.getAddressByString(CHAIN);
  const chain = Chain__factory.connect(chainAddress, hre.ethers.provider);

  console.log({ chainAddress });
  const status = await chain.getStatus();
  console.log(status);
  console.log(status.nextBlockId);

  console.log(await stakingBank.validators(await stakingBank.addresses(0)));
  console.log(await stakingBank.validators(await stakingBank.addresses(1)));
});
