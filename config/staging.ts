import {GlobalConfig} from './types';
import {readValidators} from './utils';

const staging: GlobalConfig = {
  ethereum: {
    contractRegistry: {
      address: '0x4545e91d2e3647808670DD045eA5f4079B436EbC'
    },
    token: {
      totalSupply: '1000000' + '0'.repeat(18),
      name: 'Umbrella',
      symbol: 'UMB'
    },
    chain: {
      padding: 60
    },
    validators: readValidators('https://validator-dev.umb.network'),
  },
  smartchain: {
    contractRegistry: {
      address: '0x8f98d3B5C911206C1Ac08B9938875620A03BCd59'
    },
    token: {
      totalSupply: '1000000' + '0'.repeat(18),
      name: 'Umbrella',
      symbol: 'UMB'
    },
    chain: {
      padding: 60
    },
    validators: readValidators('https://validator-bsc-dev.umb.network'),
  }
};

export default staging;
