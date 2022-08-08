import { deployChainAndRegister } from './deployers/contracts';
import { pressToContinue } from './utils/helpers';
import { ChainContractNames } from '../types/types';

const deployAndRegister = async () => deployChainAndRegister(ChainContractNames.Chain);

pressToContinue('y', () => {
  deployAndRegister()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
});
