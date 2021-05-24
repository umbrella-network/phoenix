import {GlobalConfig} from './types';
import {readValidators} from './utils';

const production: GlobalConfig = {
  ethereum: {
    contractRegistry: {
      address: '0x968A798Be3F73228c66De06f7D1109D8790FB64D'
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
      address: '0xa3A8D57DFeC72fe69FB0D7D1991e7B242De3603A'
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
