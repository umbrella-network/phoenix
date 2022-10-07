import { task } from 'hardhat/config';
import { BigNumber } from 'ethers';

import { REGISTRY, STAKING_BANK_STATE } from '../constants';
import { chainDeploymentData } from '../deploy/deploymentsData';
import { fetchValidatorsData, resolveMasterChainValidators, ValidatorData } from './_helpers/resolveValidators';
import { isMasterChain } from '../constants/networks';
import { Registry, Registry__factory } from '../typechain';

const concatValidators = (current: ValidatorData[], toClone: ValidatorData[]): ValidatorData[] => {
  const result: Record<string, bigint> = {};

  current.forEach((v) => {
    result[v.address] = 0n;
  });

  toClone.forEach((v) => {
    result[v.address] = v.balance;
  });

  return Object.keys(result).map((addr) => {
    return {
      address: addr,
      balance: result[addr],
    };
  });
};

task('clone-validators', 'Clone validators data from MasterChain to current blockchain').setAction(
  async (taskArgs, hre) => {
    const { deployments } = hre;
    const [deployerSigner] = await hre.ethers.getSigners();

    console.log({ taskArgs });
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    console.log(`NETWORK: ${hre.network.name} (${chainId})`);

    if (await isMasterChain(chainId)) throw Error('you can not clone to masterchain');

    const registryDeployments = await deployments.get(REGISTRY);
    const registry: Registry = Registry__factory.connect(registryDeployments.address, hre.ethers.provider);

    const [currentValidators, bankData] = await Promise.all([
      fetchValidatorsData(registry),
      resolveMasterChainValidators(hre),
    ]);

    if (bankData.validatorsData.length == 0) {
      throw new Error('no validators');
    }

    console.log({ currentValidators, validatorsToClone: bankData.validatorsData, supply: bankData.totalSupply });

    const data = await chainDeploymentData(hre);
    console.log({ data });

    console.log('cloning validators...');

    const dataToClone = concatValidators(currentValidators, bankData.validatorsData);
    console.log({ dataToClone });

    const addressesBefore = (await deployments.read(STAKING_BANK_STATE, 'getNumberOfValidators')).toNumber();

    const tx = await deployments.execute(
      STAKING_BANK_STATE,
      {
        log: true,
        from: deployerSigner.address,
        waitConfirmations: 1,
      },
      'setBalances',
      dataToClone.map((v) => v.address),
      dataToClone.map((v) => v.balance),
      bankData.totalSupply
    );

    console.log('tx', tx.transactionHash);

    const balances: BigNumber[] = await Promise.all(
      bankData.validatorsData.map((v) => deployments.read(STAKING_BANK_STATE, 'balanceOf', v.address))
    );

    balances.forEach((b, i) => {
      const equal = b.toBigInt() == bankData.validatorsData[i].balance;
      console.log(bankData.validatorsData[i].address, equal);
    });

    const addressesAfter = (await deployments.read(STAKING_BANK_STATE, 'getNumberOfValidators')).toNumber();

    console.log('number of validators before', addressesBefore);
    console.log('number of validators now', addressesAfter);
  }
);
