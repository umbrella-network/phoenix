import { task } from 'hardhat/config';

import { CHAIN, REGISTRY, STAKING_BANK, STAKING_BANK_STATIC } from '../constants';
import { resolveChainName } from './_helpers/resolveChainName';

/*
npx hardhat static-bank-verify-after --network arbitrum_production
npx hardhat static-bank-verify-after --network avalanche_production
npx hardhat static-bank-verify-after --network eth_production
npx hardhat static-bank-verify-after --network bnb_production
npx hardhat static-bank-verify-after --network polygon_production
 */
task('static-bank-verify-after', 'verify chain status').setAction(async (taskArgs, hre) => {
  const { deployments } = hre;
  const { read } = deployments;

  const chainId = parseInt(await hre.getChainId(), 10);
  const CHAIN_NAME = resolveChainName(chainId);

  const [registeredBank, registeredChain, bank, chain] = await Promise.all([
    read(REGISTRY, 'getAddressByString', STAKING_BANK),
    read(REGISTRY, 'getAddressByString', CHAIN),
    deployments.get(STAKING_BANK_STATIC),
    deployments.get(CHAIN_NAME),
  ]);

  const [validatorsCount, bankInChain, lastBlockId] = await Promise.all([
    read(STAKING_BANK_STATIC, 'NUMBER_OF_VALIDATORS'),
    read(CHAIN_NAME, 'stakingBank'),
    read(CHAIN_NAME, 'lastBlockId'),
  ]);

  console.log(`validatorsCount ${validatorsCount}`);
  console.log(`registered chain ${registeredChain}`);
  console.log(`chain ${chain.address}`);
  console.log(`bankInChain ${bankInChain}`);
  console.log(`lastBlockId ${lastBlockId}`);

  if (validatorsCount != 15) throw Error(`validatorsCount expected 15 got ${validatorsCount}`);

  if (registeredBank.toLowerCase() != bankInChain.toLowerCase()) {
    throw Error(`stakingBankInChain expected ${registeredBank.address} got ${bankInChain}`);
  }

  if (registeredBank.toLowerCase() != bank.address.toLowerCase()) {
    throw Error(`stakingBank not registered expected ${bank}`);
  }

  if (registeredChain.toLowerCase() != chain.address.toLowerCase()) {
    throw Error(`chain not registered expected ${bank.address}`);
  }

  if (lastBlockId == 0) throw Error('chain should be active');

  console.log(hre.network.name, 'OK');
});
