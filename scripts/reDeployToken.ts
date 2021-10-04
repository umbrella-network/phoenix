import { deployDummyToken, registerContract } from './deployers/contracts';
import { pressToContinue } from './utils/helpers';

const reDeployAndRegister = async () => {
  const token = await deployDummyToken();
  console.log('token updated:', token.address);
  await registerContract([token.address]);
};

pressToContinue('y', () => {
  reDeployAndRegister()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
});
