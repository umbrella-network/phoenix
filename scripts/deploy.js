const bre = require("@nomiclabs/buidler");
const config = require('../config/config');

const currentProvider = new web3.providers.HttpProvider('http://localhost:8545')
const provider = new ethers.providers.Web3Provider(currentProvider);

const waitForTx = async txHash => {
  if (bre.network.name === 'buidlerevm') {
    return
  }

  await provider.waitForTransaction(txHash)
}

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
    const id = await accounts[index].getAddress()
    let tx = await validatorRegistry.create(id, validator.location);

    await waitForTx(tx.hash)

    const validatorData = await validatorRegistry.validators(id)
    console.log("Added validator number " + index + " with address " + id + " at location " + validatorData.location);

    tx = await token.approve(stakingBank.address, config.token.totalSupply);
    await waitForTx(tx.hash)

    tx = await stakingBank.receiveApproval(id, config.token.totalSupply, 0);
    await waitForTx(tx.hash)

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
