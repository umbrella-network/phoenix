const bre = require('@nomiclabs/buidler');
const web3 = bre.web3;
const Chain = require('../artifacts/Chain');

const {CHAIN_CONTRACT_ADDRESS} = process.env;

async function main() {
  const currentProvider = new web3.providers.HttpProvider('http://localhost:8545');
  const provider = new ethers.providers.Web3Provider(currentProvider);

  const chain = new bre.ethers.Contract(CHAIN_CONTRACT_ADDRESS, Chain.abi, provider);

  console.log('blockPadding:', (await chain.blockPadding()).toString());
  console.log('blockHeight:', (await chain.getBlockHeight()).toString());

  chain.on('LogMint', (sender, blockHeight, blockNumber) => {
    console.log('LogMint:', sender, blockHeight, blockNumber);
    chain.blocks(blockHeight.toString()).then(console.log);
  });

  console.log('watching for mined blocks...');
}

main().then().catch(console.log);
