import { pressToContinue } from './utils/helpers';

import { deployAllContracts } from './deployers/contracts';

pressToContinue('y', () => {
  deployAllContracts('', true)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
});
