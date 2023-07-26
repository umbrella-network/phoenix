import { task } from 'hardhat/config';

import { deployerSigner } from './_helpers/jsonRpcProvider';
import { REGISTRY, UMBRELLA_FEEDS } from '../constants';
import { Registry__factory } from '../typechain';

/*
npx hardhat registerUmbrellaFeeds --network bnb_staging
 */
task('registerUmbrellaFeeds', 'UmbrellaFeeds registration')
  .addFlag('update', 'if contract is already registered, use this flag to update')
  .setAction(async (taskArgs, hre) => {
    const deployer = deployerSigner(hre);
    const registryDeployments = await hre.deployments.get(REGISTRY);
    const registry = Registry__factory.connect(registryDeployments.address, deployer);
    const registryOwner = await registry.owner();

    if (registryOwner.toLowerCase() != deployer.address.toLowerCase()) {
      console.log('!'.repeat(80));
      console.log(`importing ${UMBRELLA_FEEDS} address to registry not possible - not an owner`);
      console.log('!'.repeat(80));
      console.log({ registryOwner, deployer: deployer.address });
      return;
    }

    const umbrellaFeeds = await hre.deployments.get(UMBRELLA_FEEDS);
    const inRegistry = await registry.getAddressByString(UMBRELLA_FEEDS);
    console.log({ inRegistry });

    if (inRegistry.toLowerCase() != umbrellaFeeds.address.toLowerCase()) {
      if (inRegistry.toLowerCase() != hre.ethers.constants.AddressZero && !taskArgs.update) {
        console.log('!'.repeat(80));
        console.log(`${UMBRELLA_FEEDS} already registered under ${inRegistry}, use --update flag to update`);
        console.log('!'.repeat(80));
        return;
      }

      const nonce = await deployer.getTransactionCount('latest');
      console.log({ nonce, from: deployer.address });

      const tx = await registry.importContracts([umbrellaFeeds.address], { nonce });
      console.log(`${UMBRELLA_FEEDS} (${umbrellaFeeds.address}) registered`);
      console.log(`tx #${tx.nonce} ${tx.hash}, waiting for confirmation...`);
      await tx.wait(1);
    }
  });
