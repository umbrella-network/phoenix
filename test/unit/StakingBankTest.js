const {use, expect} = require('chai');
const {ContractFactory} = require('ethers');
const {waffleChai} = require('@ethereum-waffle/chai');
const {deployMockContract} = require('@ethereum-waffle/mock-contract');
const {loadFixture} = require('ethereum-waffle');

const Registry = require('../../artifacts/Registry');
const ValidatorRegistry = require('../../artifacts/ValidatorRegistry');
const StakingBank = require('../../artifacts/StakingBank');
const Token = require('../../artifacts/Token');
const {toBytes32} = require('../../scripts/helpers');

use(waffleChai);

async function fixture([owner, validator]) {
  const contractRegistry = await deployMockContract(owner, Registry.abi);
  const token = await deployMockContract(owner, Token.abi);
  const validatorRegistry = await deployMockContract(owner, ValidatorRegistry.abi);
  const contractFactory = new ContractFactory(StakingBank.abi, StakingBank.bytecode, owner);

  await token.mock.name.returns('abc');
  await token.mock.symbol.returns('abc');

  const contract = await contractFactory.deploy(contractRegistry.address, 'Umbrella', 'UMB');

  return {
    owner,
    validator,
    token,
    contractRegistry,
    validatorRegistry,
    contract
  };
}

describe('StakingBank', () => {
  let contract;

  beforeEach(async () => {
    ({contract} = await loadFixture(fixture));
  });

  describe('when deployed', () => {
    it('expect to have token', async () => {
      expect(await contract.getName()).to.eq(toBytes32('StakingBank'));
    });
  });
});
