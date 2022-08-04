import {GlobalConfig} from './types';
import {readValidators} from './utils';

const replicator = '0x620583C75BB474E06485893B795b0883b5816D10';

const staging: GlobalConfig = {
  arbitrum: {
    distributor: {
      address: ''
    },
    contractRegistry: {
      address: '0x97e8922eac4fa07e958667E3e7AEa7a7fe3eC9f6'
    },
    chain: {
      padding: 60 * 50,
      requiredSignatures: 1,
      replicator
    },
  },
  avalanche: {
    distributor: {
      address: '0xbC758FCB97e06Ec635DFf698f55e41aCC35e1d2d'
    },
    contractRegistry: {
      address: '0x65833489170A55374786B97C96e691949C60175a'
    },
    chain: {
      padding: 60,
      requiredSignatures: 1,
      replicator
    },
  },
  polygon: {
    distributor: {
      address: '0x3fBdba5E516611e2E9C1aA6cdFB8376c7cA7d7CE'
    },
    contractRegistry: {
      address: '0xaB61f05a9dabCEd63c9100b623A4c29FfD9bf077'
    },
    chain: {
      padding: 60,
      requiredSignatures: 1,
      replicator
    },
  },
  ethereum: {
    contractRegistry: {
      address: '0x3F2254bc49d2d6e8422D71cB5384fB76005558A9'
    },
    chain: {
      padding: 300,
      requiredSignatures: 2,
      replicator
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
      replicator
    },
    stakingBank: {
      minAmountForStake: 100n * BigInt(1e18),
    },
    validators: readValidators('https://validator-bsc-dev.umb.network'),
  }
};

export default staging;
