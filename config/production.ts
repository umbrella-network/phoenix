import {GlobalConfig} from './types';
import {readValidators} from './utils';

const production: GlobalConfig = {
  ethereum: {
    contractRegistry: {
      address: '0x8d16D5D2859f4c54b226180A46F26D57A4d727A0'
    },
    token: {
      totalSupply: '1000000' + '0'.repeat(18),
      name: 'Umbrella test token',
      symbol: 'UMB'
    },
    chain: {
      padding: 60
    },
    validators: readValidators('https://validator.umb.network'),
  },
  smartchain: {
    contractRegistry: {
      address: '0x3508848650Bb8eA55390fAEefA13312cb4D87E1d'
    },
    token: {
      totalSupply: '1000000' + '0'.repeat(18),
      name: 'Umbrella test token',
      symbol: 'UMB'
    },
    chain: {
      padding: 60
    },
    validators: readValidators('https://validator-bsc.umb.network'),
  }
};

export default production;
