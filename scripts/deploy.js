require('custom-env').env();
const { INFURA_ID } = process.env;

const bre = require('@nomiclabs/buidler');
const config = require('../config/config');

let currentProvider;
let provider;

if (['buidlerevm', 'localhost'].includes(bre.network.name)) {
  currentProvider = new bre.web3.providers.HttpProvider('http://localhost:8545');
  provider = new ethers.providers.Web3Provider(currentProvider);
} else {
  provider = new ethers.providers.JsonRpcProvider(`https://kovan.infura.io/v3/${INFURA_ID}`);
}

const waitForTx = async txHash => {
  if (bre.network.name === 'buidlerevm') {
    return;
  }

  console.log('waiting for tx to be mined...', txHash);
  const receipt = await provider.waitForTransaction(txHash);

  if (receipt.status !== 1) {
    console.log(receipt);
    throw Error('rejected tx');
  }

  console.log('...success');
};

async function main() {
  const {VALIDATOR_PK} = process.env;

  if (!VALIDATOR_PK) {
    throw new Error('please setup VALIDATOR_PK in .env');
  }

  const [owner] = await ethers.getSigners();
  console.log('DEPLOYING FROM ADDRESS:', await owner.getAddress());

  const validatorWallet = new ethers.Wallet(VALIDATOR_PK, provider);
  const id = await validatorWallet.getAddress();

  const TokenContract = await ethers.getContractFactory('Token');
  const token = await TokenContract.deploy(config.token.name, config.token.symbol, config.token.totalSupply);
  await token.deployed();
  console.log('Token deployed to:', token.address);

  const ValidatorRegistryContract = await ethers.getContractFactory('ValidatorRegistry');
  const validatorRegistry = await ValidatorRegistryContract.deploy();
  await validatorRegistry.deployed();
  console.log('ValidatorRegistry deployed to:', validatorRegistry.address);

  const StakingBankContract = await ethers.getContractFactory('StakingBank');
  const stakingBank = await StakingBankContract.deploy(token.address, validatorRegistry.address);
  await stakingBank.deployed();
  console.log('StakingBank deployed to:', stakingBank.address);

  const ChainContract = await ethers.getContractFactory('Chain');
  const chain = await ChainContract.deploy(validatorRegistry.address, stakingBank.address, config.chain.interval);
  await chain.deployed();
  console.log('Chain deployed to:', chain.address);

  let tx = await token.transfer(id, config.token.totalSupply);
  await waitForTx(tx.hash);
  console.log('token transfered to validator:', config.token.totalSupply);

  if (['buidlerevm', 'localhost'].includes(bre.network.name)) {
    const balance = await validatorWallet.getBalance();

    if (balance.eq(0)) {
      console.log('sending ETH to validator');
      const ownerBalance = await owner.getBalance();
      tx = await owner.sendTransaction({to: id, value: ownerBalance.div(2).toHexString()});
      await waitForTx(tx.hash);
    }
  }

  // todo - make it work for multiple validators in a future
  const validator = config.validators[0];

  tx = await validatorRegistry.create(id, validator.location);
  await waitForTx(tx.hash);

  const validatorData = await validatorRegistry.validators(id);
  console.log('Added validator with address ' + id + ' at location ' + validatorData.location);

  tx = await token.connect(validatorWallet).approve(stakingBank.address, config.token.totalSupply);
  await waitForTx(tx.hash);

  tx = await stakingBank.receiveApproval(id, config.token.totalSupply, 0);
  await waitForTx(tx.hash);

  console.log('validator balance:', (await token.balanceOf(id)).toString());
  console.log('staked balance:', (await stakingBank.balanceOf(id)).toString());

  const leader = await chain.getLeaderAddress();
  console.log('Current leader: ' + leader);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
