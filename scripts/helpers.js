require('custom-env').env();

const bre = require('@nomiclabs/buidler');

const isLocalNetwork = () => ['buidlerevm', 'localhost'].includes(bre.network.name);

const getProvider = () => {
  if (isLocalNetwork()) {
    const currentProvider = new bre.web3.providers.HttpProvider('http://localhost:8545');
    return new bre.ethers.providers.Web3Provider(currentProvider);
  } else {
    return new bre.ethers.providers.JsonRpcProvider(bre.config.networks[bre.network.name].url);
  }
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
};

const toBytes32 = str => {
  const bytes = Buffer.from(str).toString('hex');
  return `0x${bytes}${'0'.repeat(64 - bytes.length)}`;
};

module.exports = {
  isLocalNetwork,
  getProvider,
  waitForTx,
  toBytes32
};
