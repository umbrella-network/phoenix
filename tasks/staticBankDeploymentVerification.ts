import { task } from 'hardhat/config';

import { STAKING_BANK_STATIC } from '../constants';
import { resolveChainName } from './_helpers/resolveChainName';

/*
npx hardhat static-bank-verify --network arbitrum_production
npx hardhat static-bank-verify --network avalanche_production
npx hardhat static-bank-verify --network eth_production
npx hardhat static-bank-verify --network bnb_production
npx hardhat static-bank-verify --network polygon_production



npx hardhat registerChain --network arbitrum_production
npx hardhat registerChain --network avalanche_production
npx hardhat registerChain --network eth_production
npx hardhat registerChain --network bnb_production
npx hardhat registerChain --network polygon_production
 */
task('static-bank-verify', 'verify if bank has 15 validators and chain has new bank').setAction(
  async (taskArgs, hre) => {
    const { deployments } = hre;
    const { read } = deployments;

    const chainId = parseInt(await hre.getChainId(), 10);
    const CHAIN_NAME = resolveChainName(chainId);

    const [bank, chain, validatorsCount, bankInChain, lastBlockId] = await Promise.all([
      deployments.get(STAKING_BANK_STATIC),
      deployments.get(CHAIN_NAME),
      read(STAKING_BANK_STATIC, 'NUMBER_OF_VALIDATORS'),
      read(CHAIN_NAME, 'stakingBank'),
      read(CHAIN_NAME, 'lastBlockId'),
    ]);

    console.log(`validatorsCount ${validatorsCount}`);
    console.log(`chain ${chain.address}`);
    console.log(`bankInChain ${bankInChain}`);
    console.log(`lastBlockId ${lastBlockId}`);

    if (validatorsCount != 15) throw Error(`validatorsCount expected 15 got ${validatorsCount}`);

    if (bank.address.toLowerCase() != bankInChain.toLowerCase()) {
      throw Error(`stakingBankInChain expected ${bank.address} got ${bankInChain}`);
    }

    if (lastBlockId != 0) throw Error('chain should not be registered!');

    console.log(hre.network.name, 'OK');
  }
);
