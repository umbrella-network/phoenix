import { deployLimitedMintingDummyToken, registerContract } from './deployers/contracts';
import { pressToContinue } from './utils/helpers';

const deployAndRegister = async () => {
  const token = await deployLimitedMintingDummyToken();

  console.log('token updated:', token.address);
  await registerContract([token.address]);
};

pressToContinue('y', () => {
  deployAndRegister()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
});
