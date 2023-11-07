import { task } from 'hardhat/config';

import { deployerSigner } from './_helpers/jsonRpcProvider';
import { REGISTRY, UMBRELLA_FEEDS } from '../constants';
import { Registry__factory, UmbrellaFeeds__factory } from '../typechain';
import { string } from 'hardhat/internal/core/params/argumentTypes';

/*
npx hardhat registerUmbrellaFeeds --network bnb_staging --destroy UMB-USD
 */
task('registerUmbrellaFeeds', 'UmbrellaFeeds registration')
  .addFlag('update', 'if contract is already registered, use this flag to update')
  .addParam('destroy', 'feed key that is not empty', '', string)
  .setAction(async (taskArgs, hre) => {
    const deployer = deployerSigner(hre);
    const registryDeployments = await hre.deployments.get(REGISTRY);
    const registry = Registry__factory.connect(registryDeployments.address, deployer);
    const registryOwner = await registry.owner();

    const umbrellaFeedsDeployments = await hre.deployments.get(UMBRELLA_FEEDS);
    const newUmbrellaFeeds = UmbrellaFeeds__factory.connect(umbrellaFeedsDeployments.address, deployer);

    if (registryOwner.toLowerCase() != deployer.address.toLowerCase()) {
      console.log('!'.repeat(80));
      console.log(`importing ${UMBRELLA_FEEDS} address to registry not possible - not an owner`);
      console.log('!'.repeat(80));
      console.log({ registryOwner, deployer: deployer.address });
      return;
    }

    const inRegistry = await registry.getAddressByString(UMBRELLA_FEEDS);
    console.log({ inRegistry });
    console.log({ newUmbrellaFeeds: newUmbrellaFeeds.address });

    if (inRegistry.toLowerCase() != newUmbrellaFeeds.address.toLowerCase()) {
      const oldExists = inRegistry.toLowerCase() != hre.ethers.constants.AddressZero;

      if (oldExists && !taskArgs.update) {
        console.log('!'.repeat(80));
        console.log(`${UMBRELLA_FEEDS} already registered under ${inRegistry}, use --update flag to update`);
        console.log('!'.repeat(80));
        return;
      }

      const nonce = await deployer.getTransactionCount('latest');
      console.log({ nonce, from: deployer.address });

      if (oldExists) {
        const oldUmbrellaFeeds = UmbrellaFeeds__factory.connect(inRegistry, deployer);

        const price = await oldUmbrellaFeeds.getPriceDataByName(taskArgs.destroy);

        if (oldExists && price.timestamp == 0) {
          if (taskArgs.destroy != 'any') throw new Error(`provided key ${taskArgs.destroy} is empty in ${inRegistry}`);
        } else {
          console.log(`key ${taskArgs.destroy} exists so old contract ${inRegistry} will be destroyed`);
        }
      }

      const tx = await registry.importContracts([newUmbrellaFeeds.address], {
        nonce,
        gasPrice: hre.network.config.gasPrice == 'auto' ? undefined : hre.network.config.gasPrice,
      });

      console.log(`importContracts tx #${tx.nonce} ${tx.hash}`);

      if (oldExists) {
        const oldUmbrellaFeeds = UmbrellaFeeds__factory.connect(inRegistry, deployer);

        const tx2 = await oldUmbrellaFeeds.destroy(taskArgs.destroy, {
          nonce: nonce + 1,
          gasPrice: hre.network.config.gasPrice == 'auto' ? undefined : hre.network.config.gasPrice,
        });

        console.log(`destroy tx #${tx2.nonce} ${tx2.hash}`);
        console.log('waiting for confirmations...');
        await tx2.wait(1);
      } else {
        console.log('waiting for confirmations...');
        await tx.wait(1);
      }

      console.log(`${UMBRELLA_FEEDS} (${newUmbrellaFeeds.address}) registered`);
    }
  });
