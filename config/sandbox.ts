import {GlobalConfig} from './types';
import {readValidators} from './utils';

const staging: GlobalConfig = {
  ethereum: {
    contractRegistry: {
      address: ''
    },
    token: {
      totalSupply: '1000000' + '0'.repeat(18),
      name: 'Umbrella',
      symbol: 'UMB'
    },
    chain: {
      padding: 60,
      requiredSignatures: 1
    },
    stakingBank: {
      minAmountForStake: 100n * BigInt(1e18),
    },
    validators: readValidators('https://validator.sbx.umb.network'),
  },
  smartchain: {
    distributor: {
      address: '0x2BB2B0df0DB14EAfd5FCaBc46Fd543F7a6dFF8E9'
    },
    contractRegistry: {
      address: '0xE1cDcE9A678E84Aa73d3266176C6E11b3eDc4f67'
    },
    token: {
      totalSupply: '1000000' + '0'.repeat(18),
      name: 'Umbrella',
      symbol: 'UMB'
    },
    chain: {
      padding: 60,
      requiredSignatures: 1
    },
    stakingBank: {
      minAmountForStake: 100n * BigInt(1e18),
    },
    validators: readValidators('https://validator-bsc.sbx.umb.network'),
  }
};

export default staging;
