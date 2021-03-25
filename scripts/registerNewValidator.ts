require('custom-env').env(); // eslint-disable-line

import {deployedContract} from './utils/deployedContracts';
import {getProvider, waitForTx} from './utils/helpers';

const provider = getProvider();

interface Validator {
  id: string,
  location: string
}

const registerNewValidator = async () => {
  const stakingBank = await deployedContract('StakingBank');
  const validatorRegistry = await deployedContract('ValidatorRegistry');
  const token = await deployedContract('UMB');

  const validator: Validator = {
    id: process.env.NEW_VALIDATOR_ID as string,
    location: process.env.NEW_VALIDATOR_LOCATION as string
  };

  if (!validator.id || !validator.location) {
    throw Error('New validator has empty data, please setup env: NEW_VALIDATOR_ID and NEW_VALIDATOR_LOCATION');
  }

  console.log('new validator:', validator);
  console.log('validator registry:', validatorRegistry.address);
  console.log('stakingBank:', stakingBank.address);
  console.log('token:', token.address);

  let tx = await validatorRegistry.create(validator.id, validator.location);
  await waitForTx(tx.hash, provider);
  console.log('new validator created');

  tx = await token.mintApproveAndStake(stakingBank.address, validator.id, '2'+'0'.repeat(18));
  await waitForTx(tx.hash, provider);
  console.log('new validator created');
};

registerNewValidator()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
