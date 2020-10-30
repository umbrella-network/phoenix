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

async function fixture([owner, validator], provider) {
  const token = await deployMockContract(owner, Token.abi)
  const validatorRegistry = await deployMockContract(owner, ValidatorRegistry.abi)
  const stakingBank = await deployMockContract(owner, StakingBank.abi)
  const contractFactory = new ContractFactory(Chain.abi, Chain.bytecode, owner)

  const contract = await contractFactory.deploy(
    validatorRegistry.address,
    stakingBank.address,
    100
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

const leafHash = data => ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string'], [data]))
const hash2buffer = hash => Buffer.from(hash.slice(2), 'hex')

const leafHash1 = leafHash('eth-usd=1234')
const leafHash2 = leafHash('btc-usd=5678')

const inputs = [hash2buffer(leafHash1), hash2buffer(leafHash2)]
const depth = Math.ceil(Math.log2(inputs.length)) + 1
const tree = new SparseMerkleTree(inputs, depth)
const root = tree.getRoot()

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

