require('custom-env').env(); // eslint-disable-line

import {verifyContract} from '../utils/verifyContract';
import {ethers} from 'hardhat';
import {Contract, Wallet, BigNumber} from 'ethers';

import configuration from '../../config';
import Registry from '../../artifacts/contracts/Registry.sol/Registry.json';
import {constructorAbi, getProvider, isLocalNetwork, toBytes32, waitForTx} from '../utils/helpers';

const config = configuration();
const provider = getProvider();

interface Validator {
  wallet: Wallet,
  location: string,
  balance: BigNumber,
  privateKey: string
}

export const deployChain = async (contractRegistryAddress: string): Promise<Contract> => {
  console.log('deploying Chain...');
  const ChainContract = await ethers.getContractFactory('Chain');
  const chainArgs = [contractRegistryAddress, config.chain.blockPadding];
  const chainArgsTypes = ['address', 'uint256'];

  const chain = await ChainContract.deploy(...chainArgs);
  await chain.deployed();

  await verifyContract(chain.address, 'Chain', constructorAbi(chainArgsTypes, chainArgs));

  return chain;
};

export const deployValidatorRegistry = async (): Promise<Contract> => {
  console.log('deploying ValidatorRegistry...');
  const ValidatorRegistryContract = await ethers.getContractFactory('ValidatorRegistry');
  const validatorRegistry = await ValidatorRegistryContract.deploy();
  await validatorRegistry.deployed();

  await verifyContract(validatorRegistry.address, 'ValidatorRegistry', '');
  return validatorRegistry;
};

let contractRegistry: Contract;

export const registerContract = async (addresses: string[]): Promise<void> => {
  if (!contractRegistry) {
    const [owner] = await ethers.getSigners();
    contractRegistry = new ethers.Contract(config.contractRegistry.address, Registry.abi, provider).connect(owner);
  }

  const tx = await contractRegistry.importContracts(addresses);
  await waitForTx(tx.hash, provider);
  console.log('contracts registered');
};

export const registerValidator = async (
  validatorRegistry: Contract,
  stakingBank: Contract,
  token: Contract,
  validatorId: number
): Promise<void> => {
  const validator = config.validators[validatorId];
  const validatorWallet = new ethers.Wallet(validator.privateKey, provider);
  const id = await validatorWallet.getAddress();

  let tx = await validatorRegistry.create(id, validator.location);
  await waitForTx(tx.hash, provider);

  const validatorData = await validatorRegistry.validators(id);
  console.log('Added validator with address ' + id + ' at location ' + validatorData.location);

  console.log('setting up staking...');
  tx = await token.mintApproveAndStake(stakingBank.address, id, `${validatorId+1}${'0'.repeat(18)}`);
  await waitForTx(tx.hash, provider);

  console.log('validator balance:', (await token.balanceOf(id)).toString());
  console.log('staked balance:', (await stakingBank.balanceOf(id)).toString());
};

export const deployAllContracts = async (
  registryAddress = '',
  doRegistration = false
): Promise<{ chain: string; bank: string; validatorRegistry: string; token: string }> => {
  if (!config.validators.length) {
    console.log('random PK', ethers.Wallet.createRandom({
      extraEntropy: Buffer.from(Math.random().toString(10))
    }).privateKey);
    throw new Error(
      'please setup (VALIDATOR_PK, VALIDATOR_LOCATION) or (VALIDATOR_?_PK, VALIDATOR_?_LOCATION) in .env'
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

  const validators: Validator[] = await Promise.all(config.validators.map(async ({privateKey, location}) => {
    const wallet = new ethers.Wallet(privateKey, provider);
    const balance = await wallet.getBalance();
    console.log(`validator ${wallet.address} ETH balance:`, balance.toString());

    return {location, wallet, balance, privateKey};
  }));

  if (isLocalNetwork()) {
    for (const {balance, wallet} of validators) {
      if (balance.toString() === '0') {
        console.log('sending ETH to validator');
        const ownerBalance = await owner.getBalance();

        const tx = await owner.sendTransaction(
          {to: wallet.address, value: ownerBalance.div(validators.length + 1).toHexString()});
        await waitForTx(tx.hash, provider);
      }
    }
  } else {
    validators.forEach(({balance, wallet}) => {
      if (balance.lt(BigNumber.from('10000000000000000'))) {
        throw Error(`validator ${wallet.address} does not have enough ETH`);
      }
    });
  }

  console.log('deploying test token...');
  const TokenContract = await ethers.getContractFactory('Token');
  const tokenTypes = ['string', 'string'];
  const tokenArgs = [config.token.name, config.token.symbol];
  const token = await TokenContract.deploy(...tokenArgs);
  await token.deployed();

  if (contractRegistry) {
    console.log('registering test token...');
    await registerContract([token.address]);
    console.log('Token registered:', await contractRegistry.getAddressByString('UMB'));
  } else {
    console.log('Token deployed to:', token.address);
  }

  await verifyContract(token.address, 'Token', constructorAbi(tokenTypes, tokenArgs));

  const validatorRegistry = await deployValidatorRegistry();

  if (contractRegistry) {
    const tx = await contractRegistry.importAddresses([toBytes32('ValidatorRegistry')], [validatorRegistry.address]);
    await waitForTx(tx.hash, provider);
    console.log('validatorRegistry registered', await contractRegistry.getAddressByString('ValidatorRegistry'));
  } else {
    console.log('ValidatorRegistry deployed to:', validatorRegistry.address);
  }

  console.log('deploying StakingBank...');
  const StakingBankContract = await ethers.getContractFactory('StakingBank');

  const stakingBankArgs = [contractRegistryAddress, config.token.name, config.token.symbol];
  const stakingBankArgsTypes = ['address', 'string', 'string'];

  const stakingBank = await StakingBankContract.deploy(...stakingBankArgs);
  await stakingBank.deployed();

  if (contractRegistry) {
    await registerContract([stakingBank.address]);
    console.log('stakingBank registered', await contractRegistry.getAddress(await stakingBank.getName()));
  } else {
    console.log('StakingBank deployed to:', stakingBank.address);
  }

  await verifyContract(stakingBank.address, 'StakingBank', constructorAbi(stakingBankArgsTypes, stakingBankArgs));

  const chain = await deployChain(contractRegistryAddress);

  if (contractRegistry) {
    await registerContract([chain.address]);
    console.log('chain registered', await contractRegistry.getAddress(await chain.getName()));
  } else {
    console.log('Chain deployed to:', chain.address);
  }

  for (let i = 0; i < validators.length; i++) {
    await registerValidator(validatorRegistry, stakingBank, token, i);
  }

  const leader = await chain.getLeaderAddress();
  console.log('Current leader: ' + leader);

  return {
    token: token.address,
    chain: chain.address,
    bank: stakingBank.address,
    validatorRegistry: validatorRegistry.address
  };
};
