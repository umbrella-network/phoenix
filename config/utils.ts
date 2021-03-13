import {Validator} from './types';

export const readValidators = (defaultLocation: string): Validator[] => {
  const result: Validator[] = [];

  const {VALIDATOR_PK, VALIDATOR_LOCATION} = process.env;

  if (VALIDATOR_PK) {
    return [{
      privateKey: VALIDATOR_PK,
      location: VALIDATOR_LOCATION || defaultLocation,
    }];
  }

  for (let i = 0;; ++i) {
    const privateKey = process.env[`VALIDATOR_${i}_PK`],
      location = process.env[`VALIDATOR_${i}_LOCATION`] as string;

    if (!privateKey) {
      break;
    }

    result.push({privateKey, location});
  }

  return result;
};
