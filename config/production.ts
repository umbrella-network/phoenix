import {Config} from './types';
import {readValidators} from './utils';

const production: Config = {
  contractRegistry: {
    address: '0x8d16D5D2859f4c54b226180A46F26D57A4d727A0'
  },
  token: {
    totalSupply: '1000000000000000000000',
    name: 'Umbrella test token',
    symbol: 'UMB'
  },
  chain: {
    blockPadding: 6
  },
  validators: readValidators('https://validator.umb.network'),
};

export default production;
