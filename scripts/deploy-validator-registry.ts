require('custom-env').env(); // eslint-disable-line

import {deployValidatorRegistry, registerContract} from './deployers/contracts';

const deployAndRegister = async () => {
  const validatorRegistry = await deployValidatorRegistry();
  console.log('ValidatorRegistry updated:', validatorRegistry.address);
  await registerContract([validatorRegistry.address]);
};

deployAndRegister()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
