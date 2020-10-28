const bre = require("@nomiclabs/buidler");
const config = require('../config/config');

async function main() {
  const TokenContract = await ethers.getContractFactory("Token");
  const token = await TokenContract.deploy(config.token.name, config.token.symbol, config.token.totalSupply);
  await token.deployed();
  console.log("Token deployed to:", token.address);

  const ValidatorRegistryContract = await ethers.getContractFactory("ValidatorRegistry");
  const validatorRegistry = await ValidatorRegistryContract.deploy();
  await validatorRegistry.deployed();
  console.log("ValidatorRegistry deployed to:", validatorRegistry.address);

  const StakingBankContract = await ethers.getContractFactory("StakingBank");
  const stakingBank = await StakingBankContract.deploy(token.address, validatorRegistry.address);
  await stakingBank.deployed();
  console.log("StakingBank deployed to:", stakingBank.address);

  const ChainContract = await ethers.getContractFactory("Chain");
  const chain = await ChainContract.deploy(validatorRegistry.address, stakingBank.address, config.chain.interval);
  await chain.deployed();
  console.log("Chain deployed to:", chain.address);

  const accounts = await ethers.getSigners();

  for (let index = 0; index < config.validators.length; index++) {
    const validator = config.validators[index];
    const validatorWallet = ethers.Wallet.createRandom()
    const id = await validatorWallet.getAddress()
    await validatorRegistry.create(id, validator.location);
    console.log("Added validator ", id);
    console.log("validator PK", validatorWallet.privateKey);
    console.log("validator number " + index + " at location " + validator.location);

    await token.mintAndStake(id, '2000000000000000000', stakingBank.address);
    console.log("validator balance:", (await token.balanceOf(id)).toString());
    console.log("staked balance:", (await stakingBank.balanceOf(id)).toString());
  }

  const leader = await chain.getLeaderAddress();
  console.log("Current leader: " + leader);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
