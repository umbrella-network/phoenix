import { pressToContinue } from './utils/helpers';

require('custom-env').env(); // eslint-disable-line

import { deployContractRegistry } from './deployers/registry';

pressToContinue('y', () => {
  deployContractRegistry()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
});
