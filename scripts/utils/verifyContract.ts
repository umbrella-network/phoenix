import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { isLocalNetwork, sleep } from './helpers';

export const verifyCode = async (
  hre: HardhatRuntimeEnvironment,
  address: string,
  constructorArguments: any // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<void> => {
  if (isLocalNetwork(hre) || process.env.FAKE_MAINNET) {
    return;
  }

  console.log('verifyCode for ', address, hre.network.name);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await hre.run('verify:verify', { address, constructorArguments });
      break;
    } catch (e: unknown) {
      console.log((<Error>e).message);
      if ((<Error>e).message.toLowerCase().includes('already verified')) break;
      if ((<Error>e).message.toLowerCase().includes("doesn't recognize it as a supported chain")) break;
      console.log('retrying in 5 sec...');
      await sleep(5000);
    }
  }
};
