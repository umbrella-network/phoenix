import { GlobalConfig} from './types';
import {readValidators} from './utils';

const replicator = '0x620583C75BB474E06485893B795b0883b5816D10';

const local: GlobalConfig = {
  arbitrum: {
    contractRegistry: {
      address: '0x7c2C195CD6D34B8F845992d380aADB2730bB9C6F'
    },
    chain: {
      padding: 65535,
      requiredSignatures: 1,
      replicator
    },
  },
  avalanche: {
    contractRegistry: {
      address: '0xDa9A63D77406faa09d265413F4E128B54b5057e0'
    },
    chain: {
      padding: 1800,
      requiredSignatures: 1,
      replicator
    },
  },
  polygon: {
    contractRegistry: {
      address: '0x455acbbC2c15c086978083968a69B2e7E4d38d34'
    },
    chain: {
      padding: 240,
      requiredSignatures: 1,
      replicator
    },
  },
  ethereum: {
    contractRegistry: {
      address: '0x41a75b8504fdac22b2152b5cfcdaae01ff50947e'
    },
    chain: {
      padding: 65535,
      requiredSignatures: 1,
      replicator
    },
  },
  bsc: {
    contractRegistry: {
      address: '0xb2C6c4162c0d2B6963C62A9133331b4D0359AA34'
    },
    token: {
      address: '0x846f52020749715f02aef25b5d1d65e48945649d',
      totalSupply: '1000000' + '0'.repeat(18),
      name: 'UMB token',
      symbol: 'UMB'
    },
    chain: {
      padding: 240,
      requiredSignatures: 6,
      replicator
    },
    stakingBank: {
      minAmountForStake: 100n * BigInt(1e18),
    },
    validators: readValidators('https://validator-bsc.umb.network'),
  }
};

export default local;
