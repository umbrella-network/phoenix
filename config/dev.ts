import {Config} from './types';
import {readValidators} from './utils';

const dev: Config = {
  contractRegistry: {
    address: '0x4545e91d2e3647808670DD045eA5f4079B436EbC'
  },
  token: {
    totalSupply: '1000000000000000000',
    name: 'Umbrella',
    symbol: 'UMB'
  },
  chain: {
    blockPadding: 6
  },
  validators: readValidators('https://validator-dev.umb.network'),
};

export default dev;
