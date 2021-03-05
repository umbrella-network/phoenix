require('custom-env').env(); // eslint-disable-line

import {verifyContract} from '../utils/verifyContract';
import {ethers} from 'hardhat';

import configuration from '../../config';
import Registry from '../../artifacts/contracts/Registry.sol/Registry.json';
import {constructorAbi, getProvider, isLocalNetwork, toBytes32, waitForTx} from '../utils/helpers';

const {BigNumber} = ethers;

const config = configuration();
const provider = getProvider();

export const deployAllContracts = async (
  registryAddress = '',
  doRegistration = false
): Promise<{ chain: any; bank: any; validatorRegistry: any; token: any }> => {
  const {VALIDATOR_PK} = process.env;

  if (!VALIDATOR_PK) {
    console.log('random PK', ethers.Wallet.createRandom().privateKey);
    throw new Error('please setup VALIDATOR_PK in .env');
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

  const validatorWallet = new ethers.Wallet(VALIDATOR_PK, provider);
  const id = await validatorWallet.getAddress();

  const balance = await validatorWallet.getBalance();
  console.log('validator ETH balance:', balance.toString());
  let tx;

  if (isLocalNetwork()) {
    if (balance.toString() === '0') {
      console.log('sending ETH to validator');
      const ownerBalance = await owner.getBalance();
      tx = await owner.sendTransaction({to: id, value: ownerBalance.div(2).toHexString()});
      await waitForTx(tx.hash, provider);
    }
  } else {
    if (balance.lt(BigNumber.from('10000000000000000'))) {
      throw Error(`validator ${validatorWallet.address} does not have enough ETH`);
    }
  }

  console.log('deploying test token...');
  const TokenContract = await ethers.getContractFactory('Token');
  const token = await TokenContract.deploy(config.token.name, config.token.symbol, config.token.totalSupply);
  await token.deployed();

  if (contractRegistry) {
    console.log('registering test token...');
    tx = await contractRegistry.importContracts([token.address]);
    await waitForTx(tx.hash, provider);
    console.log('Token registered:', await contractRegistry.getAddressByString('UMB'));
  } else {
    console.log('Token deployed to:', token.address);
  }

  await verifyContract(token.address, 'Token', '');

  console.log('deploying ValidatorRegistry...');
  const ValidatorRegistryContract = await ethers.getContractFactory('ValidatorRegistry');
  const validatorRegistry = await ValidatorRegistryContract.deploy();
  await validatorRegistry.deployed();

  if (contractRegistry) {
    tx = await contractRegistry.importAddresses([toBytes32('ValidatorRegistry')], [validatorRegistry.address]);
    await waitForTx(tx.hash, provider);
    console.log('validatorRegistry registered', await contractRegistry.getAddressByString('ValidatorRegistry'));
  } else {
    console.log('ValidatorRegistry deployed to:', validatorRegistry.address);
  }

  await verifyContract(validatorRegistry.address, 'ValidatorRegistry', '');

  console.log('deploying StakingBank...');
  const StakingBankContract = await ethers.getContractFactory('StakingBank');

  const stakingBankArgs = [contractRegistryAddress, config.token.name, config.token.symbol];
  const stakingBankArgsTypes = ['address', 'string','string'];

  const stakingBank = await StakingBankContract.deploy(...stakingBankArgs);
  await stakingBank.deployed();

  if (contractRegistry) {
    tx = await contractRegistry.importContracts([stakingBank.address]);
    await waitForTx(tx.hash, provider);
    const name = await stakingBank.getName();
    console.log(name);
    console.log('stakingBank registered', await contractRegistry.getAddress(name));
  } else {
    console.log('StakingBank deployed to:', stakingBank.address);
  }

  await verifyContract(stakingBank.address, 'StakingBank', constructorAbi(stakingBankArgsTypes, stakingBankArgs));

  console.log('deploying Chain...');
  const ChainContract = await ethers.getContractFactory('Chain');
  const chainArgs = [contractRegistryAddress, config.chain.blockPadding];
  const chainArgsTypes = ['address', 'uint256'];

  const chain = await ChainContract.deploy(...chainArgs);
  await chain.deployed();

  if (contractRegistry) {
    tx = await contractRegistry.importContracts([chain.address]);
    await waitForTx(tx.hash, provider);
    console.log('chain registered', await contractRegistry.getAddress(await chain.getName()));
  } else {
    console.log('Chain deployed to:', chain.address);
  }

  await verifyContract(chain.address, 'Chain', constructorAbi(chainArgsTypes, chainArgs));

  tx = await token.transfer(id, config.token.totalSupply);
  await waitForTx(tx.hash, provider);
  console.log('token transferred to validator:', config.token.totalSupply);

  // todo - make it work for multiple validators in a future
  const validator = config.validators[0];

  tx = await validatorRegistry.create(id, validator.location);
  await waitForTx(tx.hash, provider);

  const validatorData = await validatorRegistry.validators(id);
  console.log('Added validator with address ' + id + ' at location ' + validatorData.location);

  const approval = '100000'; //config.token.totalSupply;
  tx = await token.connect(validatorWallet).approve(stakingBank.address, approval);
  await waitForTx(tx.hash, provider);

  console.log('...receiveApproval...');
  tx = await stakingBank.receiveApproval(id, approval, 0);
  await waitForTx(tx.hash, provider);

  console.log('validator balance:', (await token.balanceOf(id)).toString());
  console.log('staked balance:', (await stakingBank.balanceOf(id)).toString());

  const leader = await chain.getLeaderAddress();
  console.log('Current leader: ' + leader);

  return {
    token: token.address,
    chain: chain.address,
    bank: stakingBank.address,
    validatorRegistry: validatorRegistry.address
  };
};
