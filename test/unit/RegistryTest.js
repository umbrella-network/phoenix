const { expect, use } = require('chai');

const {ContractFactory} = require('ethers');
const {waffleChai} = require('@ethereum-waffle/chai');
const {deployMockContract} = require('@ethereum-waffle/mock-contract');
const {loadFixture} = require('ethereum-waffle');
const {toBytes32} = require('../../scripts/helpers');

const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;

const Registrable = require('../../artifacts/Registrable');
const Registry = require('../../artifacts/Registry');

use(waffleChai);

async function fixture([owner]) {
  const registrable = await deployMockContract(owner, Registrable.abi);
  const contractFactory = new ContractFactory(Registry.abi, Registry.bytecode, owner);
  const contract = await contractFactory.deploy();

  return {
    owner,
    registrable,
    contract
  };
}

describe('Registry', () => {
  const aName32 = toBytes32('a');
  const bName32 = toBytes32('b');
  const registrableName = 'registrable';

  let owner, contract, registrable;

  beforeEach(async () => {
    ({owner, registrable, contract} = await loadFixture(fixture));
  });

  describe('when deployed', () => {
    it('expect valid owner', async () => {
      expect(await contract.owner()).to.equal(owner.address);
    });
  });

  describe('stringToBytes32()', () => {
    it('expect to match off-chain method', async () => {
      expect(await contract.stringToBytes32(registrableName)).to.eq(toBytes32(registrableName));
    });
  });

  describe('importContracts()', () => {
    it('expect to import contracts', async () => {
      await registrable.mock.getName.returns(toBytes32(registrableName));

      await expect(contract.importContracts([registrable.address]))
        .to.emit(contract, 'LogRegistered').withArgs(registrable.address, toBytes32(registrableName));
    });
  });

  describe('importAddresses()', () => {
    it('expect NOT to throw when nothing to import', async () => {
      expect(await contract.importAddresses([], [])).not.throw;
    });

    it('expect to import single item', async () => {
      expect(await contract.importAddresses([aName32], [owner.address])).not.throw;
    });

    it('expect to import multiple items', async () => {
      expect(await contract.importAddresses([aName32, bName32], [owner.address, owner.address])).not.throw;
    });

    it('expect to throw when uneven number of inputs', async () => {
      await expect(contract.importAddresses([aName32, bName32], [owner.address])).to.revertedWith('Input lengths must match');
      await expect(contract.importAddresses([aName32], [owner.address, owner.address])).to.revertedWith('Input lengths must match');
    });
  });

  describe('when address imported', () => {
    beforeEach(async () => {
      await contract.importAddresses([toBytes32(registrableName)], [registrable.address]);
    });

    describe('getAddress()', () => {
      it('expect to return valid address', async () => {
        expect(await contract.getAddress(toBytes32(registrableName))).to.eq(registrable.address);
      });

      it('expect to return valid address by string', async () => {
        expect(await contract.getAddressByString(registrableName)).to.eq(registrable.address);
      });

      it('expect not to throw when address not exists', async () => {
        expect(await contract.getAddress(toBytes32('-----'))).to.eq(ZERO_ADDRESS);
      });
    });

    describe('requireAndGetAddress()', () => {
      it('expect to return valid address', async () => {
        expect(await contract.requireAndGetAddress(toBytes32(registrableName))).to.eq(registrable.address);
      });

      it('expect to throw when address not exists', async () => {
        await expect(contract.requireAndGetAddress(toBytes32('-----'))).to.be.revertedWith('revert Name not registered: -----');
      });
    });
  });
});
