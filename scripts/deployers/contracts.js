require('custom-env').env();

const config = require('../../config/config');
const Registry = require('../../artifacts/Registry');
const {toBytes32} = require('../helpers');

const {getProvider, waitForTx, isLocalNetwork} = require('../helpers');

const provider = getProvider();

exports.deployAllContracts = async (registryAddress = '', doRegistration = false) => {
  const {VALIDATOR_PK} = process.env;

  if (!VALIDATOR_PK) {
    throw new Error('please setup VALIDATOR_PK in .env');
  }

  const contractRegistryAddress = registryAddress || config.contractRegistry.address;

  if (!contractRegistryAddress) {
    throw new Error('contractRegistryAddress is empty');
  } else {
    console.log('CONTRACT REGISTRY ADDRESS:', contractRegistryAddress);

  }

  let contractRegistry;
  const [owner] = await ethers.getSigners();
  console.log('DEPLOYING FROM ADDRESS:', await owner.getAddress());

  if (doRegistration) {
    contractRegistry = new ethers.Contract(contractRegistryAddress, Registry.abi, provider).connect(owner);
  }

  const validatorWallet = new ethers.Wallet(VALIDATOR_PK, provider);
  const id = await validatorWallet.getAddress();

  const TokenContract = await ethers.getContractFactory('Token');
  const token = await TokenContract.deploy(config.token.name, config.token.symbol, config.token.totalSupply);
  await token.deployed();

  if (doRegistration) {
    await contractRegistry.importContracts([token.address]);
    console.log('Token registered:', await contractRegistry.getAddressByString('UMB'));
  } else {
    console.log('Token deployed to:', token.address);
  }

  const ValidatorRegistryContract = await ethers.getContractFactory('ValidatorRegistry');
  const validatorRegistry = await ValidatorRegistryContract.deploy();
  await validatorRegistry.deployed();

  if (doRegistration) {
    await contractRegistry.importAddresses([toBytes32('ValidatorRegistry')], [validatorRegistry.address]);
    console.log('validatorRegistry registered', await contractRegistry.getAddressByString('ValidatorRegistry'));
  } else {
    console.log('ValidatorRegistry deployed to:', validatorRegistry.address);
  }

  const StakingBankContract = await ethers.getContractFactory('StakingBank');
  const stakingBank = await StakingBankContract.deploy(contractRegistryAddress, config.token.name, config.token.symbol);
  await stakingBank.deployed();

  if (doRegistration) {
    await contractRegistry.importContracts([stakingBank.address]);
    const name = await stakingBank.getName();
    console.log(name);
    console.log('stakingBank registered', await contractRegistry.getAddress(name));
  } else {
    console.log('StakingBank deployed to:', stakingBank.address);
  }

  const ChainContract = await ethers.getContractFactory('Chain');
  const chain = await ChainContract.deploy(contractRegistryAddress, config.chain.blockPadding);
  await chain.deployed();

  if (doRegistration) {
    await contractRegistry.importContracts([chain.address]);
    console.log('chain registered', await contractRegistry.getAddress(await chain.getName()));
  } else {
    console.log('Chain deployed to:', chain.address);
  }

  let tx = await token.transfer(id, config.token.totalSupply);
  await waitForTx(tx.hash, provider);
  console.log('token transfered to validator:', config.token.totalSupply);

  if (isLocalNetwork()) {
    const balance = await validatorWallet.getBalance();

    if (balance.eq(0)) {
      console.log('sending ETH to validator');
      const ownerBalance = await owner.getBalance();
      tx = await owner.sendTransaction({to: id, value: ownerBalance.div(2).toHexString()});
      await waitForTx(tx.hash, provider);
    }
  }

  // todo - make it work for multiple validators in a future
  const validator = config.validators[0];

  tx = await validatorRegistry.create(id, validator.location);
  await waitForTx(tx.hash, provider);

  const validatorData = await validatorRegistry.validators(id);
  console.log('Added validator with address ' + id + ' at location ' + validatorData.location);

  tx = await token.connect(validatorWallet).approve(stakingBank.address, config.token.totalSupply);
  await waitForTx(tx.hash, provider);

  tx = await stakingBank.receiveApproval(id, config.token.totalSupply, 0);
  await waitForTx(tx.hash, provider);

  console.log('validator balance:', (await token.balanceOf(id)).toString());
  console.log('staked balance:', (await stakingBank.balanceOf(id)).toString());

  const leader = await chain.getLeaderAddress();
  console.log('Current leader: ' + leader);

  return {
    token: token.address,
    chain: chain.address,
    bank: stakingBank.address,
    validatorRegistry: validatorRegistry.address
  };
};
