require('custom-env').env();

const {getProvider, isLocalNetwork} = require('../helpers');

let provider = getProvider();

exports.deployContractRegistry = async () => {
  const {STAGING_PK} = process.env;

  let ownerWallet;

  if (isLocalNetwork()) {
    [ownerWallet] = await ethers.getSigners();
  } else {
    if (!STAGING_PK) {
      throw new Error('please setup STAGING_PK in .env');
    }

    ownerWallet = new ethers.Wallet(STAGING_PK, provider);
  }

  const owner = await ownerWallet.getAddress();
  console.log('DEPLOYING FROM ADDRESS:', owner);

  const RegistryContract = await ethers.getContractFactory('Registry');
  const registry = await RegistryContract.deploy();
  await registry.deployed();

  console.log('Registry:', registry.address);
  return registry;
};
