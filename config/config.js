const path = require('path');
const rootPath = path.normalize(__dirname + '/..');
const env = process.env.NODE_ENV || 'development';

const config = {
  development: {
    token: {
      totalSupply: '1000000000000000000',
      name: 'Umbrella',
      symbol: 'UMB'
    },
    chain: {
      interval: 16
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
      interval: 16
    },
    validators: [
      {
        location: 'http://localhost:3000'
      }
    ]
  }
};

module.exports = config[env];
