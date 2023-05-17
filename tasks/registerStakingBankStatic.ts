import { task } from 'hardhat/config';

import { deployerSigner } from './_helpers/jsonRpcProvider';
import { REGISTRY, STAKING_BANK, STAKING_BANK_STATIC } from '../constants';
import { Registry__factory } from '../typechain';

/*
npx hardhat registerStakingBankStatic --network bnb_staging
 */
task('registerStakingBankStatic', 'chain contract registration')
  .addFlag('update', 'if contract is already registered, use this flag to update')
  .setAction(async (taskArgs, hre) => {
    const deployer = deployerSigner(hre);
    const registryDeployments = await hre.deployments.get(REGISTRY);
    const registry = Registry__factory.connect(registryDeployments.address, deployer);
    const registryOwner = await registry.owner();

    if (registryOwner.toLowerCase() != deployer.address.toLowerCase()) {
      console.log('!'.repeat(80));
      console.log(`importing ${STAKING_BANK_STATIC} address to registry not possible - not an owner`);
      console.log('!'.repeat(80));
      console.log({ registryOwner, deployer: deployer.address });
      return;
    }

    const stakingBankStatic = await hre.deployments.get(STAKING_BANK_STATIC);
    const inRegistry = await registry.getAddressByString(STAKING_BANK);
    console.log({ inRegistry });

    if (inRegistry.toLowerCase() != stakingBankStatic.address.toLowerCase()) {
      if (inRegistry.toLowerCase() != hre.ethers.constants.AddressZero && !taskArgs.update) {
        console.log('!'.repeat(80));
        console.log(`${STAKING_BANK_STATIC} already registered under ${inRegistry}, use --update flag to update`);
        console.log('!'.repeat(80));
        return;
      }

      const tx = await registry.importContracts([stakingBankStatic.address]);
      console.log(`${STAKING_BANK_STATIC} (${stakingBankStatic.address}) registered, waiting for confirmation...`);
      await tx.wait(1);
    }

    console.log('next steps:');
    console.log('npx hardhat deploy --network', hre.network.name);
    console.log('npx hardhat registerChain --network', hre.network.name);
  });
