const {use, expect} = require('chai')
const {ContractFactory} = require('ethers')
const {waffleChai} = require('@ethereum-waffle/chai')
const {loadFixture} = require('ethereum-waffle')


const ValidatorRegistry = require('../../artifacts/ValidatorRegistry')

use(waffleChai)

async function fixture([owner, validator], provider) {
  const contractFactory = new ContractFactory(ValidatorRegistry.abi, ValidatorRegistry.bytecode, owner)
  const contract = await contractFactory.deploy()

  return {
    owner,
    validator,
    contract
  }
}


describe('ValidatorRegistry', () => {
  let owner, validator, contract

  beforeEach(async () => {
    ({
      owner, validator, contract
    } = await loadFixture(fixture))
  })

  describe('when deployed', () => {
    it('expect to have 0 validators', async () => {
      expect(await contract.getNumberOfValidators()).to.eq(0)
    })
  })

  describe('create()', () => {
    it('expect to creates validators', async () => {
      await expect(contract.create(validator.address, 'IP')).not.to.be.reverted
    })

    describe('when created', () => {
      beforeEach(async () => {
        await contract.create(validator.address, 'IP')
      })

      it('expect to have 1 validator', async () => {
        expect(await contract.getNumberOfValidators()).to.eq(1)
      })

      it('expect addresses() to return validator', async () => {
        expect(await contract.addresses(0)).to.eq(validator.address)
      })
    })
  })
})
