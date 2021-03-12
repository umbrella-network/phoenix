import {Config} from './types';
import {readValidators} from './utils';

const local: Config = {
  contractRegistry: {
    address: '0x7c2C195CD6D34B8F845992d380aADB2730bB9C6F'
  },
  token: {
    totalSupply: '1000000000000000000',
    name: 'Umbrella',
    symbol: 'UMB'
  },
  chain: {
    blockPadding: 6
  },
  validators: readValidators('http://localhost:3000'),
};

export default local;
