import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { HttpNetworkConfig } from 'hardhat/src/types/config';

import { STAKING_BANK } from '../../constants';
import { Registry, Registry__factory, StakingBank, StakingBank__factory } from '../../typechain';
import { isMasterChain, MASTER_CHAIN_NAME } from '../../constants/networks';

export type ValidatorData = {
  address: string;
  balance: bigint;
};

export const fetchValidatorsData = async (registry: Registry): Promise<ValidatorData[]> => {
  const stakingBankAddress = await registry.getAddressByString(STAKING_BANK);
  const stakingBank: StakingBank = StakingBank__factory.connect(stakingBankAddress, registry.provider);

  console.log('pulling data from staking bank:', stakingBank.address);

  const validatorsCount = await stakingBank.getNumberOfValidators();

  const data = [];

  for (let i = 0; i < validatorsCount.toNumber(); i++) {
    data.push(stakingBank.addresses(i));
  }

  const validators = await Promise.all(data);

  const balances = await Promise.all(validators.map((v) => stakingBank.balanceOf(v)));

  return validators.map((v, i) => {
    return {
      address: v,
      balance: balances[i].toBigInt(),
    };
  });
};

export const resolveMasterChainValidators = async (
  hre: HardhatRuntimeEnvironment,
  masterChainName: string
): Promise<{
  validatorsData: ValidatorData[];
  totalSupply: bigint;
}> => {
  if (!masterChainName) {
    throw new Error('missing MASTER_CHAIN_NAME');
  }

  const masterChainConfig = hre.config.networks[masterChainName] as HttpNetworkConfig;
  console.log({ masterChainConfig });

  if (!masterChainConfig) {
    throw new Error(`missing masterChainConfig for ${MASTER_CHAIN_NAME}`);
  }

  const masterChainRpc = masterChainConfig.url;

  if (!masterChainRpc) {
    throw new Error('missing masterChainRpc');
  }

  const mainnetDeployments = path.join(__dirname, '..', '..', 'deployments', masterChainName);
  const registryDeployments = JSON.parse(fs.readFileSync(path.join(mainnetDeployments, 'Registry.json'), 'utf-8'));

  const provider = new ethers.providers.JsonRpcProvider(masterChainRpc);
  const { chainId } = await provider.getNetwork();

  if (!isMasterChain(chainId)) {
    throw new Error(`${masterChainName} (${chainId}) is not marsterchain`);
  }

  const registry: Registry = Registry__factory.connect(registryDeployments.address, provider);
  const stakingBankAddress = await registry.getAddressByString(STAKING_BANK);
  const stakingBank: StakingBank = StakingBank__factory.connect(stakingBankAddress, provider);

  console.log(`pulling data from ${masterChainName}`);

  const [validatorsData, totalSupply] = await Promise.all([fetchValidatorsData(registry), stakingBank.totalSupply()]);

  return {
    validatorsData,
    totalSupply: totalSupply.toBigInt(),
  };
};
