const config = require('../config/config');
const bre = require('@nomiclabs/buidler');

const web3 = bre.web3;

const { INFURA_ID } = process.env;

const isLocalNetwork = () => ['buidlerevm', 'localhost'].includes(bre.network.name);

const getProvider = () => {
  let currentProvider;
  let provider;

  console.log('NETTWORK:', bre.network.name);

  if (isLocalNetwork()) {
    currentProvider = new bre.web3.providers.HttpProvider('http://localhost:8545');
    provider = new ethers.providers.Web3Provider(currentProvider);
  } else {
    provider = new ethers.providers.JsonRpcProvider(`https://kovan.infura.io/v3/${INFURA_ID}`);
  }

  return provider;
};

const waitForTx = async (txHash, provider) => {
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
  return receipt;
};

const mineBlock = async () => {
  await send({ method: 'evm_mine' });
  const bn = await web3.eth.getBlockNumber();
  console.log('ETH block number: ', bn, 'block height: ', Math.floor(bn / config.chain.interval));
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

const hash2buffer = hash => Buffer.from(hash.slice(2), 'hex');

const string2buffer = str => Buffer.from(str);

const intToBuffer = i => {
  const s = i.toString(16);
  return Buffer.from(`${s.length % 2 === 0 ? '' : '0'}${s}`, 'hex');
};

const toBytes32 = n => '0x' + Buffer.from(n).toString('hex').padEnd(64, '0');


module.exports = {
  isLocalNetwork,
  getProvider,
  waitForTx,
  toBytes32,
  intToBuffer,
  string2buffer,
  hash2buffer,
  mineBlock
};
