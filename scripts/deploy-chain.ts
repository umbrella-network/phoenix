import configuration from '../config';

require('custom-env').env(); // eslint-disable-line

import {deployChain, registerContract} from './deployers/contracts';
const config = configuration();

const deployAndRegister = async () => {
  const chain = await deployChain(config.contractRegistry.address);
  console.log('Chain updated:', chain.address);
  await registerContract([chain.address]);
};

deployAndRegister()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
