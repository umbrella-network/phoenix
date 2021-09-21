import {GlobalConfig} from './types';
import {readValidators} from './utils';

const production: GlobalConfig = {
  ethereum: {
    contractRegistry: {
      address: '0xb81f69E38669e18cfF763D7ABB77bD8BC6092Ee4'
    },
    token: {
      totalSupply: '1000000' + '0'.repeat(18),
      name: 'Umbrella test token',
      symbol: 'UMB'
    },
    chain: {
      padding: 60,
      requiredSignatures: 2,
      replicator: '0x57a2022Fa04F38207Ab3CD280557CAD6d0b77BE1'
    },
    stakingBank: {
      minAmountForStake: 100n * BigInt(1e18),
    },
    validators: readValidators('https://validator.umb.network'),
  },
  smartchain: {
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
      padding: 60,
      requiredSignatures: 4,
      replicator: '0x57a2022Fa04F38207Ab3CD280557CAD6d0b77BE1'
    },
    stakingBank: {
      minAmountForStake: 100n * BigInt(1e18),
    },
    validators: readValidators('https://validator-bsc.umb.network'),
  }
};

export default production;
