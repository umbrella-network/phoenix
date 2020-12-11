const {mineBlock} = require('./helpers');

const minting = async (blockTime) => {
  if (!blockTime) {
    throw Error('please setup .env with `LOCAL_BLOCK_TIME`.');
  }

  console.log(`start minting blocks every ${blockTime} sec... CTRL+C to stop`);
  setInterval(mineBlock, blockTime * 1000);
};

minting(process.env.LOCAL_BLOCK_TIME).then();
