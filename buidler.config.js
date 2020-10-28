require('custom-env').env()
const { INFURA_ID, STAGING_PK, NODE_ENV } = process.env;

usePlugin("@nomiclabs/buidler-waffle");

task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

module.exports = {
  networks: {
    buidlerevm: {
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_ID}`,
      accounts: STAGING_PK ? [STAGING_PK] : [],
      chainId: 42,
      gasPrice: 1000000000
    },
  },
  solc: {
    version: "0.6.8",
  },
};
