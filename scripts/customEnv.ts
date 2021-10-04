const env = process.env.HARDHAT_NETWORK?.split('_')[1];

require('custom-env').env(env); // eslint-disable-line

console.log({ TEST: process.env.TEST, net: process.env.HARDHAT_NETWORK, env });
