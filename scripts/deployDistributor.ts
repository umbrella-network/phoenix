import configuration from '../config';
import { deployDistributor, registerContract } from './deployers/contracts';
import { pressToContinue } from './utils/helpers';

const config = configuration();

const deployAndRegister = async () => {
  const recipients = config.chain.replicator ? [config.chain.replicator] : [];
  const contract = await deployDistributor(recipients);
  console.log('Distributor updated:', contract.address);
  await registerContract([contract.address]);
};

pressToContinue('y', () => {
  deployAndRegister()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
});
