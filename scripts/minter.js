const bre = require("@nomiclabs/buidler");

const web3 = bre.web3

const mineBlock = async () => {
  await send({ method: 'evm_mine' })
  console.log('ETH block number: ', await web3.eth.getBlockNumber())
}

const send = (payload) => {
  if (!payload.jsonrpc) payload.jsonrpc = '2.0'
  if (!payload.id) payload.id = new Date().getTime()

  return new Promise((resolve, reject) => {
    web3.currentProvider.send(payload, (error, result) => {
      if (error) return reject(error)

      return resolve(result)
    })
  })
}

const minting = async (blockTime) => {
  if (!blockTime) {
    throw Error('please setup .env with `LOCAL_BLOCK_TIME`.')
  }

  console.log(`start minting blocks every ${blockTime} sec... CTRL+C to stop`)
  setInterval(mineBlock, blockTime * 1000)
}

minting(process.env.LOCAL_BLOCK_TIME).then()
