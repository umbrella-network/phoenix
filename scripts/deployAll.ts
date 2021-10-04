import { deployAllContracts } from './deployers/contracts';
import { deployContractRegistry } from './deployers/registry';
import { isLocalNetwork, pressToContinue } from './utils/helpers';

async function main() {
  const registry = await deployContractRegistry();

  if (isLocalNetwork()) {
    console.log('registering contracts...');
    await deployAllContracts(registry.address, true);
    console.log('...done - local network ready.');
  } else {
    console.log(
      '\n⚠️⚠️⚠️⚠️⚠️\n',
      'setup registry address in config file and run\n\n',
      `> HARDHAT_NETWORK=${process.env.HARDHAT_NETWORK} npm run deploy:contracts`,
      '\n OR \n',
      `> HARDHAT_NETWORK=${process.env.HARDHAT_NETWORK} npm run deploy:foreignChain`,
      '\n\nto finish deployment\n⚠️⚠️⚠️⚠️⚠️\n'
    );
  }

  console.log('Registry:', registry.address);
}

pressToContinue('y', () => {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
});
