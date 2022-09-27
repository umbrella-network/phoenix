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
      address: '0xc94A585C1bC804C03A864Ee766Dd1B432f73f9A8'
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
      address: '0x22Cdc7608067870cf42a4CB568582Cf56aca2436'
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
      address: '0xcA702946B0f7d5537B3B6791F45F2E2459374C75'
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
