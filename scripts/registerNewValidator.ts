import { ethers, Contract } from 'ethers';

require('custom-env').env(); // eslint-disable-line

import superagent from 'superagent';
import { deployedContract } from './utils/deployedContracts';
import { getProvider, pressToContinue, waitForTx } from './utils/helpers';
import { formatEther } from 'ethers/lib/utils';

const provider = getProvider();

interface Validator {
  id: string;
  location: string;
}

interface ValidatorInfo {
  validator: string;
  contractRegistryAddress: string;
  validatorRegistryAddress: string;
  chainContractAddress: string;
  version: string;
  environment: string;
  name: string;
}

let validatorRegistry: Contract;

const resolveValidatorInfo = async (location: string): Promise<ValidatorInfo> => {
  const res = await superagent.get(`${location}/info`);
  return res.body;
};

const checkValidator = async (info: ValidatorInfo): Promise<boolean> => {
  if (!ethers.utils.isAddress(info.validator)) {
    throw Error(`${info.validator} is not valid address`);
  }

  console.log(`address ${info.validator} OK`);

  if (info.version !== '3.1.1') {
    throw Error(`${info.version} is not last version`);
  }

  console.log(`version ${info.version} OK`);

  const chain = await deployedContract('Chain');

  if (info.chainContractAddress !== chain.address) {
    throw Error(`${info.chainContractAddress} is not Chain from this network, should be ${chain.address}`);
  }

  console.log(`Chain ${info.chainContractAddress} OK`);

  const balance = await provider.getBalance(info.validator);
  if (balance.lt(`3${'0'.repeat(17)}`)) {
    throw Error(`validator balance is too low: ${formatEther(balance)}`);
  }

  console.log(`validator balance: ${formatEther(balance)} OK`);

  const registeredValidator = await validatorRegistry.validators(info.validator);

  if (registeredValidator.id !== ethers.constants.AddressZero) {
    throw Error(`validator ${info.validator} already registered`);
  }

  return true;
};

const registerNewValidator = async () => {
  const location = process.env.NEW_VALIDATOR_LOCATION as string;
  const stake = parseInt(process.env.NEW_VALIDATOR_STAKE as string, 10);

  if (!stake) {
    throw Error(`stake value invalid: ${stake} UMB`);
  }

  console.log(`Adding new validator based on location: ${location} with stake of ${stake} UMB`);

  const stakingBank = await deployedContract('StakingBank');
  validatorRegistry = await deployedContract('ValidatorRegistry');
  const token = await deployedContract('UMB');

  const info = await resolveValidatorInfo(location);
  await checkValidator(info);

  const validator: Validator = {
    id: info.validator,
    location,
  };

  if (!validator.id || !validator.location) {
    throw Error('New validator has empty data, please setup env: NEW_VALIDATOR_LOCATION');
  }

  console.log('new validator:', validator);
  console.log('validator registry:', validatorRegistry.address);
  console.log('stakingBank:', stakingBank.address);
  console.log('token:', token.address);

  const registeredValidator = await validatorRegistry.validators(validator.id);

  if (registeredValidator.id !== ethers.constants.AddressZero) {
    throw Error(`validator ${validator.id} already registered`);
  }

  let tx = await validatorRegistry.create(validator.id, validator.location);
  await waitForTx(tx.hash, provider);
  console.log('new validator created, now staking...');

  tx = await token.mintApproveAndStake(stakingBank.address, validator.id, stake.toString(10) + '0'.repeat(18));
  await waitForTx(tx.hash, provider);
  console.log('mintApproveAndStake DONE');
};

pressToContinue('y', () => {
  registerNewValidator()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
});
