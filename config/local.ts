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
    padding: 20,
    requiredSignatures: 1,
    replicator: '0x620583C75BB474E06485893B795b0883b5816D10'
  },
  stakingBank: {
    minAmountForStake: 1n * BigInt(1e18),
  },
  validators: readValidators('http://localhost:3000'),
};

const local: GlobalConfig = {
  ethereum: cfg,
  smartchain: cfg
};

export default local;
