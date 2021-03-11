require('custom-env').env(); // eslint-disable-line

import {deployAllContracts} from './deployers/contracts';
import {deployContractRegistry} from './deployers/registry';
import {isLocalNetwork} from './utils/helpers';

async function main() {
  const registry = await deployContractRegistry();

  if (isLocalNetwork()) {
    console.log('registering contracts...');
    await deployAllContracts(registry.address, true);
    console.log('...done - local network ready.');
  } else {
    console.log('\n⚠️⚠️⚠️⚠️⚠️\n',
      `setup registry address in config file and run\n\n> npm run deploy:contracts:${process.env.NODE_ENV}`,
      '\n\nto finish deployment\n⚠️⚠️⚠️⚠️⚠️\n');
  }

  console.log('Registry:', registry.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
