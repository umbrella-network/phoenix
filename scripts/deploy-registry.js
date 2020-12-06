require('custom-env').env();

const {deployAll} = require('./deploy-all');
const {getProvider, isLocalNetwork, toBytes32} = require('./helpers');

let provider = getProvider();

async function main() {
  const {OWNER_PK} = process.env;

  let ownerWallet;

  if (isLocalNetwork()) {
    [ownerWallet] = await ethers.getSigners();
  } else {
    if (!OWNER_PK) {
      throw new Error('please setup OWNER_PK in .env');
    }

    ownerWallet = new ethers.Wallet(OWNER_PK, provider);
  }

  const owner = await ownerWallet.getAddress();
  console.log('DEPLOYING FROM ADDRESS:', owner);

  const RegistryContract = await ethers.getContractFactory('Registry');
  const registry = await RegistryContract.deploy();
  await registry.deployed();

  if (isLocalNetwork()) {
    console.log('registering contracts...');
    const addresses = await deployAll();
    //await registry.importContracts(Object.values(addresses));

    await registry.importAddresses(
      ['Chain', 'ValidatorRegistry', 'UMB', 'StakingBank'].map(toBytes32),
      [addresses.chain, addresses.validatorRegistry, addresses.token, addresses.bank]
    );

    console.log('...done - local network ready.');
  }

  console.log('Registry:', registry.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
