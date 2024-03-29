import {GlobalConfig} from './types';
import {readValidators} from './utils';

const replicator = '0x620583c75bb474e06485893b795b0883b5816d10';

const staging: GlobalConfig = {
  arbitrum: {
    distributor: {
      address: ''
    },
    contractRegistry: {
      address: '0x85853685b5165Da1AAB09B10e927da3c2eCD429f'
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
      address: '0x26fD86791fCE0946E8D8c685446Dd257634a2b28'
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
      address: '0x29A5f90DBe54A11d37b0b18573fF853c7dc5433B'
    },
    chain: {
      padding: 60,
      requiredSignatures: 1,
      replicator
    },
  },
  ethereum: {
    contractRegistry: {
      address: '0x77922965C12bD55d6BA71b0c87E68D9F04a919Ba'
    },
    chain: {
      padding: 300,
      requiredSignatures: 1,
      replicator
    },
  },
  bsc: {
    distributor: {
      address: '0x2BB2B0df0DB14EAfd5FCaBc46Fd543F7a6dFF8E9'
    },
    contractRegistry: {
      address: '0xE1cDcE9A678E84Aa73d3266176C6E11b3eDc4f67'
    },
    token: {
      totalSupply: '1000000' + '0'.repeat(18),
      name: 'Umbrella',
      symbol: 'UMB',
      dailyMintingAllowance: '5000' + '0'.repeat(18)
    },
    chain: {
      padding: 20,
      requiredSignatures: 1,
      replicator
    },
    stakingBank: {
      minAmountForStake: 100n * BigInt(1e18),
    },
    validators: readValidators('https://validator-bsc.sbx.umb.network'),
  }
};

export default staging;
