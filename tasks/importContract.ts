import { task } from 'hardhat/config';
import { importContracToRegistry } from './_helpers/importContracToRegistry';

/*
npx hardhat importContract --network rootstock_staging --contract SovrynFetcherHelper
npx hardhat importContract --network eth_sepolia --contract UniswapV3FetcherHelper
 */
task('importContract')
  .addParam('contract', 'contract name')
  .addFlag('update', 'if contract is already registered, use this flag to update')
  .setAction(async (taskArgs, hre) => {
    console.log('importing', taskArgs.contract);

    const result = await importContracToRegistry(hre, taskArgs.contract, taskArgs.update);

    if (!result) return;
    const [tx, address] = result;

    console.log(`importContracts tx #${tx.nonce} ${tx.hash}`);
    console.log('waiting for confirmations...');
    await tx.wait(1);

    console.log(`${taskArgs.contract} (${address}) registered`);
  });
