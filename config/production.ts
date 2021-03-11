import {Config} from './Config';

const production: Config = {
  contractRegistry: {
    address: '0x8d16D5D2859f4c54b226180A46F26D57A4d727A0'
  },
  token: {
    totalSupply: '1000000000000000000000',
    name: 'Umbrella test token',
    symbol: 'UMB'
  },
  chain: {
    blockPadding: 6
  },
  validators: [
    {
      location: 'https://validator.umb.network'
    }
  ]
};

export default production;
