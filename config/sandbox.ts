import {GlobalConfig} from './types';
import {readValidators} from './utils';

const staging: GlobalConfig = {
  ethereum: {
    contractRegistry: {
      address: '0x059FDd69e771645fe91d8E1040320DbB845cEaFd'
    },
    token: {
      totalSupply: '1000000' + '0'.repeat(18),
      name: 'Umbrella',
      symbol: 'UMB'
    },
    chain: {
      padding: 300,
      requiredSignatures: 1,
      replicator: '0x620583c75bb474e06485893b795b0883b5816d10'
    },
    stakingBank: {
      minAmountForStake: 100n * BigInt(1e18),
    },
    validators: readValidators('https://validator.sbx.umb.network'),
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
      symbol: 'UMB'
    },
    chain: {
      padding: 20,
      requiredSignatures: 1,
      replicator: '0x0760b24EC17dDf59893D7c16D75353dE24c00F14'
    },
    stakingBank: {
      minAmountForStake: 100n * BigInt(1e18),
    },
    validators: readValidators('https://validator-bsc.sbx.umb.network'),
  }
};

export default staging;
