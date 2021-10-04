import hre from 'hardhat';
import { isLocalNetwork, sleep } from './helpers';

// eslint-disable-next-line
export const verifyCode = async (address: string, constructorArguments: any): Promise<void> => {
  if (isLocalNetwork()) {
    return;
  }
  console.log('verifyCode for ', address, hre.network.name);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await hre.run('verify:verify', { address, constructorArguments });
      break;
    } catch (e) {
      console.log(e.message);
      console.log('retrying in 5 sec...');
      await sleep(5000);
    }
  }
};
