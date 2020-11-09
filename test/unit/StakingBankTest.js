const {use, expect} = require('chai');
const {ContractFactory} = require('ethers');
const {waffleChai} = require('@ethereum-waffle/chai');
const {deployMockContract} = require('@ethereum-waffle/mock-contract');
const {loadFixture} = require('ethereum-waffle');

const ValidatorRegistry = require('../../artifacts/ValidatorRegistry');
const StakingBank = require('../../artifacts/StakingBank');
const Token = require('../../artifacts/Token');

use(waffleChai);

async function fixture([owner, validator]) {
  const token = await deployMockContract(owner, Token.abi);
  const validatorRegistry = await deployMockContract(owner, ValidatorRegistry.abi);
  const contractFactory = new ContractFactory(StakingBank.abi, StakingBank.bytecode, owner);

  await token.mock.name.returns('abc');
  await token.mock.symbol.returns('abc');

  const contract = await contractFactory.deploy(
    token.address,
    validatorRegistry.address
  );

  return {
    owner,
    validator,
    token,
    validatorRegistry,
    contract
  };
}

describe('StakingBank', () => {
  let token, validatorRegistry, contract;

  beforeEach(async () => {
    ({token, validatorRegistry, contract} = await loadFixture(fixture));
  });

  describe('when deployed', () => {
    it('expect to have token', async () => {
      expect(await contract.token()).to.eq(token.address);
    });

    it('expect to have validator registry', async () => {
      expect(await contract.registry()).to.eq(validatorRegistry.address);
    });
  });
});
