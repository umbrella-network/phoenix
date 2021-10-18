import {GlobalConfig} from './types';
import {readValidators} from './utils';

const staging: GlobalConfig = {
  polygon: {
    contractRegistry: {
      address: '0xaB61f05a9dabCEd63c9100b623A4c29FfD9bf077'
    },
    chain: {
      padding: 60,
      requiredSignatures: 2,
      replicator: '0x620583C75BB474E06485893B795b0883b5816D10'
    },
  },
  ethereum: {
    contractRegistry: {
      address: '0x230A8CF6F74331491Bc7B724c8194b06Cc0486c9'
    },
    chain: {
      padding: 300,
      requiredSignatures: 2,
      replicator: '0x620583C75BB474E06485893B795b0883b5816D10'
    },
  },
  bsc: {
    distributor: {
      address: '0x2BB2B0df0DB14EAfd5FCaBc46Fd543F7a6dFF8E9'
    },
    contractRegistry: {
      address: '0x8f98d3B5C911206C1Ac08B9938875620A03BCd59'
    },
    token: {
      totalSupply: '1000000' + '0'.repeat(18),
      name: 'Umbrella',
      symbol: 'UMB'
    },
    chain: {
      padding: 60,
      requiredSignatures: 2,
      replicator: '0x620583C75BB474E06485893B795b0883b5816D10'
    },
    stakingBank: {
      minAmountForStake: 100n * BigInt(1e18),
    },
    validators: readValidators('https://validator-bsc-dev.umb.network'),
  }
};

export default staging;
