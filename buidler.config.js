require('custom-env').env();

const { INFURA_ID, DEPLOYER_PK } = process.env;

usePlugin('@nomiclabs/buidler-waffle');
usePlugin('@nomiclabs/buidler-ethers');
usePlugin('@nomiclabs/buidler-web3');
usePlugin('@nomiclabs/buidler-truffle5'); // uses and exposes web3 via buidler-web3 plugin

task('accounts', 'Prints the list of accounts', async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

module.exports = {
  networks: {
    buidlerevm: {
      blockGasLimit: 80000000
    },
    localhost: {
      blockGasLimit: 80000000
    },
    dev: {
      url: `https://kovan.infura.io/v3/${INFURA_ID}`,
      accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
      chainId: 42,
      gasPrice: 1000000000
    },
    staging: {
      url: `https://ropsten.infura.io/v3/${INFURA_ID}`,
      accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
      chainId: 3,
      gasPrice: 1000000000
    },
    production: {
      url: `https://ropsten.infura.io/v3/${INFURA_ID}`,
      accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
      chainId: 3,
      gasPrice: 1000000000
    },
  },
  solc: {
    version: '0.6.8',
  },
};
