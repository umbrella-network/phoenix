const env = process.env.NODE_ENV || 'development';

const config = {
  development: {
    contractRegistry: {
      address: '0x3619DbE27d7c1e7E91aA738697Ae7Bc5FC3eACA5'
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
        location: 'http://localhost:3000'
      }
    ]
  },
  staging: {
    contractRegistry: {
      address: '0x622c7725a8D1103E44F89341A6358A0e811Df0a5'
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
        location: 'http://ae883a71637d7493fad1b62f09469eff-1487985040.us-east-2.elb.amazonaws.com'
      }
    ]
  }
};

module.exports = config[env];
