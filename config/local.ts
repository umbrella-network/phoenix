import {Config, GlobalConfig} from './types';
import {readValidators} from './utils';

const cfg: Config = {
  contractRegistry: {
    address: '0x7c2C195CD6D34B8F845992d380aADB2730bB9C6F'
  },
  token: {
    totalSupply: '1000' + '0'.repeat(18),
    name: 'Umbrella',
    symbol: 'UMB'
  },
  chain: {
    blockPadding: 6
  },
  validators: readValidators('http://localhost:3000'),
};

const local: GlobalConfig = {
  ethereum: cfg,
  smartchain: cfg
};

export default local;
