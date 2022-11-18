import hre from 'hardhat';
import { Contract } from 'ethers';

import configuration from '../config';
import { deployedContract } from './utils/deployedContracts';
import { deployStakingBank, registerContract } from './deployers/contracts';
import { pressToContinue, waitForTx } from './utils/helpers';

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
    await waitForTx(hre, tx.hash);
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

pressToContinue(hre, 'y', () => {
  reDeployAndRegister()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
});
