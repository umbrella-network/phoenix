require('custom-env').env(); // eslint-disable-line

import {deployContractRegistry} from './deployers/registry';

deployContractRegistry()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
