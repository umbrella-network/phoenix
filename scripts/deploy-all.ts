require('custom-env').env(); // eslint-disable-line

import {deployAllContracts} from './deployers/contracts';
import {deployContractRegistry} from './deployers/registry';
import {isLocalNetwork} from './utils/helpers';

async function main() {
  const registry = await deployContractRegistry();

  if (isLocalNetwork()) {
    console.log('registering contracts...');
    await deployAllContracts(registry.address, true);
    //await registry.importContracts(Object.values(addresses));

    console.log('...done - local network ready.');
  } else {
    console.log(`setup registry address in config file and run 'npm run deploy:contracts:${process.env.NODE_ENV}'`);
  }

  console.log('Registry:', registry.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
