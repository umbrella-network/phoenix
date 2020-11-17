const bre = require('@nomiclabs/buidler');
const web3 = bre.web3;

const currentProvider = new web3.providers.HttpProvider('http://localhost:8545');
const provider = new ethers.providers.Web3Provider(currentProvider);
const Chain = require('../artifacts/Chain');

async function main() {
  const chain = new ethers.Contract(process.env.CHAIN_ADDRESS, Chain.abi, provider);

  console.log('interval:', (await chain.interval()).toString());
  console.log('blockHeight:', (await chain.getBlockHeight()).toString());

  chain.on('LogMint', (sender, blockHeight, blockNumber) => {
    console.log('LogMint:', sender, blockHeight, blockNumber);
    chain.blocks(blockHeight.toString()).then(console.log);
  });

  console.log('watching for mined blocks...');
}

main().then().catch(console.log);
