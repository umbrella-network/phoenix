import { task } from 'hardhat/config';

import { deployerSigner } from './_helpers/jsonRpcProvider';
import { REGISTRY, UMBRELLA_FEEDS_READER_FACTORY } from '../constants';
import { Registry__factory } from '../typechain';

/*
npx hardhat registerReaderFactory --network bob_staging
 */
task('registerReaderFactory', 'UmbrellaFeedsReaderFactory registration')
  .addFlag('update', 'if contract is already registered, use this flag to update')
  .setAction(async (taskArgs, hre) => {
    const deployer = deployerSigner(hre);
    const registryDeployments = await hre.deployments.get(REGISTRY);
    const registry = Registry__factory.connect(registryDeployments.address, deployer);
    const registryOwner = await registry.owner();

    if (registryOwner.toLowerCase() != deployer.address.toLowerCase()) {
      console.log('!'.repeat(80));
      console.log(`importing ${UMBRELLA_FEEDS_READER_FACTORY} address to registry not possible - not an owner`);
      console.log('!'.repeat(80));
      console.log({ registryOwner, deployer: deployer.address });
      return;
    }

    const factory = await hre.deployments.get(UMBRELLA_FEEDS_READER_FACTORY);
    const inRegistry = await registry.getAddressByString(UMBRELLA_FEEDS_READER_FACTORY);
    console.log({ inRegistry });

    if (inRegistry.toLowerCase() != factory.address.toLowerCase()) {
      if (inRegistry.toLowerCase() != hre.ethers.constants.AddressZero && !taskArgs.update) {
        console.log('!'.repeat(80));
        console.log(`${UMBRELLA_FEEDS_READER_FACTORY} already registered under ${inRegistry}, use --update  to update`);
        console.log('!'.repeat(80));
        return;
      }

      const nonce = await deployer.getTransactionCount('latest');
      console.log({ nonce, from: deployer.address });

      const tx = await registry.importContracts([factory.address], { nonce });
      console.log(`${UMBRELLA_FEEDS_READER_FACTORY} (${factory.address}) registered, waiting for confirmation...`);
      await tx.wait(1);
    }
  });
