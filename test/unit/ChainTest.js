const {use, expect} = require('chai')
const {ContractFactory} = require('ethers')
const {waffleChai} = require('@ethereum-waffle/chai')
const {deployMockContract} = require('@ethereum-waffle/mock-contract')
const {loadFixture} = require('ethereum-waffle')


const SparseMerkleTree = require('../../lib/SparseMerkleTree')

const Chain = require('../../artifacts/Chain')
const ValidatorRegistry = require('../../artifacts/ValidatorRegistry')
const StakingBank = require('../../artifacts/StakingBank')
const Token = require('../../artifacts/Token')

use(waffleChai)

const interval = 100

async function fixture([owner, validator], provider) {
  const token = await deployMockContract(owner, Token.abi)
  const validatorRegistry = await deployMockContract(owner, ValidatorRegistry.abi)
  const stakingBank = await deployMockContract(owner, StakingBank.abi)
  const contractFactory = new ContractFactory(Chain.abi, Chain.bytecode, owner)

  const contract = await contractFactory.deploy(
    validatorRegistry.address,
    stakingBank.address,
    interval
  )

  return {
    owner,
    validator,
    token,
    validatorRegistry,
    stakingBank,
    contract
  }
}

const hashData = data => ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string'], [data.toString()]))
const hash2buffer = hash => Buffer.from(hash.slice(2), 'hex')

const inputs = {}

const keys = [
  'eth-eur', 'btc-eur', 'war-eur', 'ltc-eur', 'uni-eur',
  'eth-usd', 'btc-usd', 'war-usd', 'ltc-usd', 'uni-usd',
]

keys.forEach((k, i) => {
  inputs[hashData(k)] = hash2buffer(hashData(i))
})

const depth = Math.ceil(Math.log2(Object.keys(inputs).length)) + 1
const tree = new SparseMerkleTree(inputs, depth)
const root = tree.getHexRoot()

const prepareData = async (signer, blockHeight, root) => {
  const testimony = ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes32'], [blockHeight, root])
  const hashForSolidity = ethers.utils.keccak256(testimony)

  const affidavit = ethers.utils.arrayify(hashForSolidity)

  const sig = await signer.signMessage(affidavit)
  const {r, s, v} = ethers.utils.splitSignature(sig)

  return {testimony, affidavit, sig, r, s, v, hashForSolidity}
}

describe('Chain', () => {
  let owner, validator, token, validatorRegistry, stakingBank, contract

  const mockSubmit = async (leader = validator, numberOfValidators = 1, totalSupply = 1000, balance = 1000) => {
    await validatorRegistry.mock.getNumberOfValidators.returns(numberOfValidators)
    await validatorRegistry.mock.addresses.returns(leader.address)
    await stakingBank.mock.totalSupply.returns(totalSupply)
    await stakingBank.mock.balanceOf.withArgs(leader.address).returns(balance)
  }

  beforeEach(async () => {
    ({
      owner, validator, token, validatorRegistry, stakingBank, contract
    } = await loadFixture(fixture))
  })

  describe('when deployed', () => {
    it('expect to have validatorRegistry', async () => {
      expect(await contract.validatorRegistry()).to.eq(validatorRegistry.address)
    })

    it('expect to have stakingBank', async () => {
      expect(await contract.stakingBank()).to.eq(stakingBank.address)
    })

    it('expect to have interval', async () => {
      expect(await contract.interval()).to.eq(interval)
    })
  })

  describe('recoverSigner()', () => {
    it('expect to return signer', async () => {
      const {sig, affidavit, r, s, v, hashForSolidity} = await prepareData(validator, 0, root)

      const signer = await contract.recoverSigner(hashForSolidity, v, r, s)

      expect(signer).to.eq(validator.address)
      expect(await ethers.utils.verifyMessage(affidavit, sig)).to.eq(validator.address)
    })
  })

  describe('submit()', () => {
    const keys = []
    const values = []

    it('expect to mint a block', async () => {
      await mockSubmit()
      const {r, s, v} = await prepareData(validator, 0, root)

      await expect(contract.connect(validator).submit(root, keys, values, [v], [r], [s])).not.to.be.reverted
      console.log(await contract.blocks(0))
    })
  })
})

