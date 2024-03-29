import { verifyCode } from '../utils/verifyContract';
import hre, { artifacts, ethers } from 'hardhat';
import { Contract, Wallet, BigNumber, Signer } from 'ethers';
import { TransactionReceipt } from '@ethersproject/providers';

import configuration from '../../config';
import { isLocalNetwork, isProduction, waitForTx } from '../utils/helpers';
import { ensureCanRegisterChain } from '../../tasks/_helpers/ensureCanRegisterChain';
import { ChainContractNames } from '../../types/types';

const config = configuration();
const provider = hre.ethers.provider;

const Registry = artifacts.readArtifactSync('Registry');
const ERC20 = artifacts.readArtifactSync('ERC20');

interface Validator {
  wallet: Wallet;
  location: string;
  balance: BigNumber;
  privateKey: string;
}

export const deployDistributor = async (recipients: string[]): Promise<Contract> => {
  console.log('deploying Distributor...');
  const Contract = await ethers.getContractFactory('Distributor');
  const args = [recipients];

  const contract = await Contract.deploy(...args);
  await contract.deployed();

  await verifyCode(hre, contract.address, args);

  return contract;
};

export const resolveValidators = async (): Promise<Validator[]> => {
  return await Promise.all(
    config.validators.map(async ({ privateKey, location }) => {
      const wallet = new ethers.Wallet(privateKey, provider);
      const balance = await wallet.getBalance();
      console.log(`validator ${wallet.address} ETH balance:`, balance.toString());

      return { location, wallet, balance, privateKey };
    }),
  );
};

export const deployChain = async (
  contractRegistryAddress: string,
  chainName = ChainContractNames.Chain,
): Promise<Contract> => {
  console.log(`deploying ${chainName}...`);
  const ChainContract = await ethers.getContractFactory(chainName);
  const chainArgs = [contractRegistryAddress, config.chain.padding, config.chain.requiredSignatures];

  if (chainName === ChainContractNames.ForeignChain) {
    if (!config.chain.replicator) {
      const wallet = ethers.Wallet.createRandom({ extraEntropy: Buffer.from(Math.random().toString(10)) });
      console.log('random wallet:', { pk: wallet.privateKey, address: wallet.address });

      throw new Error('please setup `replicator` in config, you can use random wallet');
    }

    chainArgs.push(config.chain.replicator);
  }

  const chain = await ChainContract.deploy(...chainArgs);
  console.log('tx', chain.deployTransaction.hash);
  await chain.deployed();
  console.log(`${chainName} deployed at`, chain.address);

  await verifyCode(hre, chain.address, chainArgs);

  return chain;
};

export const deployChainAndRegister = async (chainName: ChainContractNames): Promise<void> => {
  const registry = new ethers.Contract(config.contractRegistry.address, Registry.abi, provider);
  const isForeign = await ensureCanRegisterChain(hre, registry, chainName);

  const chain = await deployChain(config.contractRegistry.address, chainName);

  if (isForeign) {
    console.log('(un)registering chain');
    await updateChain(chain.address);
  } else {
    await registerContract([chain.address]);
  }

  console.log(`${chainName} registered at ${chain.address}`);
};

export const deployStakingBank = async (contractRegistryAddress: string): Promise<Contract> => {
  console.log('deploying StakingBank...');
  const StakingBankContract = await ethers.getContractFactory('StakingBank');

  const stakingBankArgs = [
    contractRegistryAddress,
    config.stakingBank.minAmountForStake,
    config.token.name,
    config.token.symbol,
  ];

  const stakingBank = await StakingBankContract.deploy(...stakingBankArgs);
  console.log('tx', stakingBank.deployTransaction.hash);
  await stakingBank.deployed();

  if (contractRegistry) {
    await registerContract([stakingBank.address]);
    console.log('stakingBank registered', await contractRegistry.getAddress(await stakingBank.getName()));
  } else {
    console.log('StakingBank deployed to:', stakingBank.address);
  }

  await verifyCode(hre, stakingBank.address, stakingBankArgs);

  return stakingBank;
};

let contractRegistry: Contract;

export const registerContract = async (addresses: string[], names?: string[]): Promise<TransactionReceipt | null> => {
  if (!contractRegistry) {
    const [owner] = await ethers.getSigners();
    contractRegistry = new ethers.Contract(config.contractRegistry.address, Registry.abi, provider).connect(owner);
  }

  const tx = await (names
    ? contractRegistry.importAddresses(names, addresses)
    : contractRegistry.importContracts(addresses));
  return waitForTx(hre, tx.hash);
};

export const updateChain = async (chain: string): Promise<TransactionReceipt | null> => {
  if (!contractRegistry) {
    const [owner] = await ethers.getSigners();
    contractRegistry = new ethers.Contract(config.contractRegistry.address, Registry.abi, provider).connect(owner);
  }

  const tx = await contractRegistry.atomicUpdate(chain);
  return waitForTx(hre, tx.hash);
};

export const registerValidator = async (stakingBank: Contract, token: Contract, validatorId: number): Promise<void> => {
  const validator = config.validators[validatorId];
  const validatorWallet = new ethers.Wallet(validator.privateKey, provider);
  const id = await validatorWallet.getAddress();

  let tx = await stakingBank.create(id, validator.location);
  await waitForTx(hre, tx.hash);

  const validatorData = await stakingBank.validators(id);
  console.log('Added validator with address ' + id + ' at location ' + validatorData.location);

  console.log('setting up staking...');
  const stake = '100' + '0'.repeat(18);

  if (config.token.address) {
    const balance = await token.balanceOf(id);

    if (balance.lt(stake)) {
      console.warn(`validator ${id} don't have enough UMB to stake. min 100UMB.`);
      return;
    }

    console.log(`validator ${id} balance: ${balance.toString()}`);

    tx = await token.connect(validatorWallet).approve(stakingBank.address, balance);
    await waitForTx(hre, tx.hash);

    tx = await stakingBank.receiveApproval(id);
    await waitForTx(hre, tx.hash);
  } else {
    tx = await token.mintApproveAndStake(stakingBank.address, id, stake);
    await waitForTx(hre, tx.hash);
  }

  console.log('validator balance:', (await token.balanceOf(id)).toString());
  console.log('staked balance:', (await stakingBank.balanceOf(id)).toString());
};

export const deployDummyToken = async (): Promise<Contract> => {
  if (isProduction()) throw 'This contract shall not go to production';

  console.log('deploying test token...');
  const TokenContract = await ethers.getContractFactory('Token');
  const tokenArgs = [config.token.name, config.token.symbol];
  const token = await TokenContract.deploy(...tokenArgs);
  console.log('tx', token.deployTransaction.hash);

  await token.deployed();
  console.log('test token deployed');

  await verifyCode(hre, token.address, tokenArgs);
  return token;
};

export const deployLimitedMintingDummyToken = async (): Promise<Contract> => {
  if (isProduction()) throw 'This contract shall not go to production';

  console.log('deploying limited minting dummy token...');
  const TokenContract = await ethers.getContractFactory('LimitedMintingToken');
  const tokenArgs = [config.token.name, config.token.symbol, config.token.dailyMintingAllowance];
  const token = await TokenContract.deploy(...tokenArgs);
  console.log('tx', token.deployTransaction.hash);

  await token.deployed();
  console.log('test token deployed at', token.address);

  await verifyCode(hre, token.address, tokenArgs);
  return token;
};

const resolveTokenContract = async (signer: Signer): Promise<Contract> => {
  if (config.token.address) {
    console.log('using real token', config.token.address);
    return new Contract(config.token.address, ERC20.abi, signer);
  }

  const token = await deployDummyToken();
  await registerContract([token.address]);
  return token;
};

export const deployAllContracts = async (
  registryAddress = '',
  doRegistration = false,
): Promise<{ chain: string; bank: string; token: string }> => {
  if (!config.validators.length) {
    const wallet = ethers.Wallet.createRandom({ extraEntropy: Buffer.from(Math.random().toString(10)) });
    console.log('random wallet:', { pk: wallet.privateKey, address: wallet.address });

    throw new Error(
      'please setup (VALIDATOR_PK, VALIDATOR_LOCATION) or (VALIDATOR_?_PK, VALIDATOR_?_LOCATION) in .env',
    );
  }

  const contractRegistryAddress = registryAddress || config.contractRegistry.address;

  if (!contractRegistryAddress) {
    throw new Error('contractRegistryAddress is empty');
  } else {
    console.log('CONTRACT REGISTRY ADDRESS:', contractRegistryAddress);
  }

  let contractRegistry;
  const [owner] = await ethers.getSigners();
  console.log('DEPLOYING FROM ADDRESS:', await owner.getAddress());

  if (doRegistration) {
    contractRegistry = new ethers.Contract(contractRegistryAddress, Registry.abi, provider).connect(owner);
  }

  console.log(config.validators);

  const validators = await resolveValidators();

  if (isLocalNetwork(hre)) {
    for (const { balance, wallet } of validators) {
      if (balance.toString() === '0') {
        console.log('sending ETH to validator');
        const ownerBalance = await owner.getBalance();

        const tx = await owner.sendTransaction({
          to: wallet.address,
          value: ownerBalance.div(validators.length + 1).toHexString(),
        });
        await waitForTx(hre, tx.hash);
      }
    }
  } else {
    validators.forEach(({ balance, wallet }) => {
      if (balance.lt(BigNumber.from('10000000000000000'))) {
        throw Error(`validator ${wallet.address} does not have enough ETH`);
      }
    });
  }

  const token = await resolveTokenContract(owner);

  const stakingBank = await deployStakingBank(contractRegistryAddress);

  const chain = await deployChain(contractRegistryAddress);

  if (contractRegistry) {
    await registerContract([chain.address]);
    console.log('chain registered', await contractRegistry.getAddress(await chain.getName()));
  } else {
    console.log('Chain deployed to:', chain.address);
  }

  for (let i = 0; i < validators.length; i++) {
    await registerValidator(stakingBank, token, i);
  }

  const leader = await chain.getLeaderAddress();
  console.log('Current leader: ' + leader);

  return {
    token: token.address,
    chain: chain.address,
    bank: stakingBank.address,
  };
};
