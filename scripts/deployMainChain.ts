import configuration from '../config';

require('custom-env').env(); // eslint-disable-line

import { deployMainChain, registerContract } from './deployers/contracts';
import { pressToContinue } from './utils/helpers';
const config = configuration();

const deployAndRegister = async () => {
  const chain = await deployMainChain(config.contractRegistry.address);
  console.log('MainChain updated:', chain.address, 'registering...');
  await registerContract([chain.address]);
};

pressToContinue('y', () => {
  deployAndRegister()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
});
