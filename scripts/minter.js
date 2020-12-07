const bre = require('@nomiclabs/buidler');
const Chain = require('../artifacts/Chain');

const web3 = bre.web3;
const {CHAIN_CONTRACT_ADDRESS} = process.env;

const currentProvider = new web3.providers.HttpProvider('http://localhost:8545');
const provider = new ethers.providers.Web3Provider(currentProvider);

const chain = CHAIN_CONTRACT_ADDRESS ? new bre.ethers.Contract(CHAIN_CONTRACT_ADDRESS, Chain.abi, provider) : null;

const mineBlock = async () => {
  await send({ method: 'evm_mine' });
  const bn = await web3.eth.getBlockNumber();
  let blockHeight;

  if (chain) {
    blockHeight = await chain.getBlockHeight();
  }

  console.log('ETH block number: ', bn, 'blockHeight: ', blockHeight.toString());
};

const send = (payload) => {
  if (!payload.jsonrpc) payload.jsonrpc = '2.0';
  if (!payload.id) payload.id = new Date().getTime();

  return new Promise((resolve, reject) => {
    web3.currentProvider.send(payload, (error, result) => {
      if (error) return reject(error);

      return resolve(result);
    });
  });
};

const minting = async (blockTime) => {
  if (!blockTime) {
    throw Error('please setup .env with `LOCAL_BLOCK_TIME`.');
  }

  console.log(`start minting blocks every ${blockTime} sec... CTRL+C to stop`);
  setInterval(mineBlock, blockTime * 1000);
};

minting(process.env.LOCAL_BLOCK_TIME).then();
