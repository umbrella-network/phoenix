const env = process.env.NODE_ENV || 'development';

const config = {
  development: {
    token: {
      totalSupply: '1000000000000000000',
      name: 'Umbrella',
      symbol: 'UMB'
    },
    chain: {
      blockPadding: 16
    },
    validators: [
      {
        location: 'http://localhost:3000'
      }
    ]
  },
  staging: {
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
