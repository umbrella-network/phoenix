import {Config} from './Config';

const dev: Config = {
  contractRegistry: {
    address: '0xE4C2B791F6c76e535e71671C4Ab9d2914Ee42A7b'
  },
  token: {
    totalSupply: '1000000000000000000',
    name: 'Umbrella',
    symbol: 'UMB'
  },
  chain: {
    blockPadding: 6
  },
  validators: [
    {
      location: 'https://validator-dev.umb.network'
    }
  ]
};

export default dev;
