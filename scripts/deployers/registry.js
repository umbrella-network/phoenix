require('custom-env').env();
const {ethers} = require('@nomiclabs/buidler');

const {getProvider, isLocalNetwork} = require('../helpers');

let provider = getProvider();

exports.deployContractRegistry = async () => {
  const {DEPLOYER_PK} = process.env;

  let ownerWallet;

  if (isLocalNetwork()) {
    [ownerWallet] = await ethers.getSigners();
  } else {
    if (!DEPLOYER_PK) {
      throw new Error('please setup DEPLOYER_PK in .env');
    }

    ownerWallet = new ethers.Wallet(DEPLOYER_PK, provider);
  }

  const owner = await ownerWallet.getAddress();
  console.log('DEPLOYING FROM ADDRESS:', owner);

  const RegistryContract = await ethers.getContractFactory('Registry');
  const registry = await RegistryContract.deploy();
  await registry.deployed();

  console.log('Registry:', registry.address);
  return registry;
};
