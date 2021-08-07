import configuration from '../config';

require('custom-env').env(); // eslint-disable-line

import { deployedContract } from './utils/deployedContracts';
import { Contract } from 'ethers';

import { deployStakingBank, registerContract } from './deployers/contracts';
import { getProvider, pressToContinue, waitForTx } from './utils/helpers';

const provider = getProvider();
const config = configuration();

interface Validator {
  id: string;
  location: string;
}

const existingValidators = async (): Promise<Validator[]> => {
  console.log('Existing validators:');

  const stakingBank = await deployedContract('StakingBank');
  const validators: Validator[] = [];
  const validatorsCount = await stakingBank.getNumberOfValidators();

  for (let i = 0; i < validatorsCount; i++) {
    const address = await stakingBank.addresses(i);
    const { id, location } = await stakingBank.validators(address);
    validators.push({ id, location });
  }

  console.log(validators);
  return validators;
};

const migrateValidators = async (stakingBank: Contract, validators: Validator[]): Promise<void> => {
  if (!validators.length) {
    console.log('nothing to migrate');
    return;
  }

  for (const validator of validators) {
    console.log('re-creating', validator);
    const tx = await stakingBank.create(validator.id, validator.location);
    await waitForTx(tx.hash, provider);
  }

  console.log('validators migrated.');
};

const reDeployAndRegister = async () => {
  let validators: Validator[] = [];

  try {
    validators = await existingValidators();
  } catch (e) {
    // console.log(e);
    console.log('can not pull validators, most likely ABI changed');
    throw '\nin order to continue, comment out this error, run again and then add validators\n';
  }

  const stakingBank = await deployStakingBank(config.contractRegistry.address);
  console.log('StakingBank updated:', stakingBank.address);
  await migrateValidators(stakingBank, validators);
  console.log('registering StakingBank...');
  await registerContract([stakingBank.address]);
};

pressToContinue('y', () => {
  reDeployAndRegister()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
});
