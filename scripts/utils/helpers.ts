import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { TransactionReceipt } from '@ethersproject/providers';
import { Contract, ethers, Signer } from 'ethers';

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const doSnapshot = async (hre: HardhatRuntimeEnvironment): Promise<unknown> =>
  hre.network.provider.request({ method: 'evm_snapshot', params: [] });

export const revertSnapshot = async (hre: HardhatRuntimeEnvironment, snapshotId: unknown): Promise<void> => {
  console.log(`${'-'.repeat(20)} evm_revert: ${snapshotId}`);
  await hre.network.provider.request({ method: 'evm_revert', params: [snapshotId] });
};

export const isLocalNetwork = (hre: HardhatRuntimeEnvironment): boolean =>
  ['buidlerevm', 'localhost', 'docker', 'hardhat'].includes(hre.network.name);

export const isProduction = (): boolean => {
  return Boolean(process.env.HARDHAT_NETWORK?.toLowerCase().match(/prod/));
};

export const waitForTx = async (hre: HardhatRuntimeEnvironment, txHash: string): Promise<TransactionReceipt | null> => {
  if (isLocalNetwork(hre)) {
    return null;
  }

  console.log('waiting for tx to be mined...', txHash);
  const receipt = await hre.ethers.provider.waitForTransaction(txHash);

  if (receipt.status !== 1) {
    console.log(receipt);
    throw Error('rejected tx');
  }

  console.log('...success');
  return receipt;
};

export const toBytes32 = (str: string): string => {
  const bytes = Buffer.from(str).toString('hex');
  return `0x${bytes}${'0'.repeat(64 - bytes.length)}`;
};

export const pressToContinue = (hre: HardhatRuntimeEnvironment, charToPress = 'y', callback: () => void): void => {
  if (isLocalNetwork(hre)) {
    callback();
    return;
  }

  console.log('-'.repeat(80));
  const { HARDHAT_NETWORK } = process.env;
  console.log('\n\n', { HARDHAT_NETWORK });
  console.log(`\n\nCHECK IF NETWORK IS VALID, do you want to continue? (${charToPress})\n\n`);
  console.log('-'.repeat(80));

  const stdin = process.stdin;
  const { setRawMode } = stdin;

  if (setRawMode === undefined) {
    callback();
    return;
  }

  let choice = false;

  // without this, we would only get streams once enter is pressed
  // setRawMode(true);

  // resume stdin in the parent process (node app won't quit all by itself
  // unless an error or process.exit() happens)
  stdin.resume();
  // i don't want binary, do you?
  stdin.setEncoding('utf8');

  // on any data into stdin
  stdin.on('data', function (key) {
    if (choice) {
      return;
    }

    choice = true;
    console.log({ key });
    stdin.setRawMode(false);

    // ctrl-c ( end of text )
    if (key.toString() === '\u0003') {
      process.exit();
    }

    if (key.toString().slice(0, 1).toLowerCase() !== charToPress.toLowerCase()) {
      process.exit();
    }

    // write the key to stdout all normal like
    // process.stdout.write( key );
    callback();
  });
};

export const resolveContract = async (
  hre: HardhatRuntimeEnvironment,
  contractName: string,
  signer: string | Signer,
  atAddress?: string,
): Promise<Contract> => {
  const deployment = await hre.deployments.get(contractName);
  const wallet = typeof signer === 'string' ? hre.ethers.provider.getSigner(signer) : signer;

  return new ethers.Contract(atAddress ? atAddress : deployment.address, deployment.abi, wallet);
};
