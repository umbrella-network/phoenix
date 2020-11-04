require('custom-env').env()

usePlugin("@nomiclabs/buidler-waffle");
usePlugin('@nomiclabs/buidler-ethers');
usePlugin("@nomiclabs/buidler-web3");
usePlugin('@nomiclabs/buidler-truffle5'); // uses and exposes web3 via buidler-web3 plugin

task("accounts", "Prints the list of accounts", async () => {
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
  },
  solc: {
    version: "0.6.8",
  },
};
