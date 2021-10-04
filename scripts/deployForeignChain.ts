import { ChainContractNames, deployChainAndRegister } from './deployers/contracts';
import { pressToContinue } from './utils/helpers';

const deployAndRegister = async () => deployChainAndRegister(ChainContractNames.ForeignChain);

pressToContinue('y', () => {
  deployAndRegister()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
});
