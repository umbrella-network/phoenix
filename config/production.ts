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
      padding: 60,
      demo: false
    },
    validators: readValidators('https://validator.umb.network'),
  },
  smartchain: {
    contractRegistry: {
      address: '0xb2C6c4162c0d2B6963C62A9133331b4D0359AA34'
    },
    token: {
      address: '0x6fc13eace26590b80cccab1ba5d51890577d83b2',
      totalSupply: '1000000' + '0'.repeat(18),
      name: 'UMB token',
      symbol: 'UMB'
    },
    chain: {
      padding: 60,
      demo: false
    },
    validators: readValidators('https://validator-bsc.umb.network'),
  }
};

export default production;
