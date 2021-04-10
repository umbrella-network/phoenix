require('custom-env').env(); // eslint-disable-line

import { deployedContract } from './utils/deployedContracts';
import { Contract } from 'ethers';

import { deployValidatorRegistry, registerContract } from './deployers/contracts';
import { getProvider, waitForTx } from './utils/helpers';

const provider = getProvider();

interface Validator {
  id: string;
  location: string;
}

const existingValidators = async (): Promise<Validator[]> => {
  const validatorRegistry = await deployedContract('ValidatorRegistry');
  const validators: Validator[] = [];
  const validatorsCount = await validatorRegistry.getNumberOfValidators();

  for (let i = 0; i < validatorsCount; i++) {
    const address = await validatorRegistry.addresses(i);
    const { id, location } = await validatorRegistry.validators(address);
    validators.push({ id, location });
  }

  console.log('Existing validators:');
  console.log(validators);

  return validators;
};

const migrateValidators = async (validatorRegistry: Contract, validators: Validator[]): Promise<void> => {
  for (const validator of validators) {
    console.log('re-creating', validator);
    const tx = await validatorRegistry.create(validator.id, validator.location);
    await waitForTx(tx.hash, provider);
  }

  console.log('validators migrated.');
};

const reDeployAndRegister = async () => {
  const validators = await existingValidators();
  const validatorRegistry = await deployValidatorRegistry();
  console.log('ValidatorRegistry updated:', validatorRegistry.address);
  await migrateValidators(validatorRegistry, validators);
  await registerContract([validatorRegistry.address]);
};

reDeployAndRegister()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
