import { artifacts } from 'hardhat';
import { expect, use } from 'chai';

import { ethers, ContractFactory, Contract, Wallet } from 'ethers';
import { waffleChai } from '@ethereum-waffle/chai';
import { deployMockContract, MockContract } from '@ethereum-waffle/mock-contract';
import { loadFixture } from 'ethereum-waffle';

import { toBytes32 } from '../../scripts/utils/helpers';

use(waffleChai);

const Registry = artifacts.readArtifactSync('Registry');
const Registrable = artifacts.readArtifactSync('Registrable');

async function fixture([owner]: Wallet[]): Promise<{
  ownerAddress: string;
  registrable: MockContract;
  contract: Contract;
}> {
  const registrable = await deployMockContract(owner, Registrable.abi);
  const contractFactory = new ContractFactory(Registry.abi, Registry.bytecode, owner);
  const contract = await contractFactory.deploy();

  return {
    ownerAddress: await owner.getAddress(),
    registrable,
    contract,
  };
}

describe('Registry', () => {
  const aName32 = toBytes32('a');
  const bName32 = toBytes32('b');
  const registrableName = 'registrable';

  let ownerAddress: string, contract: Contract, registrable: Contract;

  beforeEach(async () => {
    ({ ownerAddress, registrable, contract } = await loadFixture(fixture));
  });

  describe('when deployed', () => {
    it('expect valid owner', async () => {
      expect(await contract.owner()).to.equal(ownerAddress);
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
        .to.emit(contract, 'LogRegistered')
        .withArgs(registrable.address, toBytes32(registrableName));
    });
  });

  describe('importAddresses()', () => {
    it('expect NOT to throw when nothing to import', async () => {
      expect(await contract.importAddresses([], [])).not.throw;
    });

    it('expect to import single item', async () => {
      expect(await contract.importAddresses([aName32], [ownerAddress])).not.throw;
    });

    it('expect to import multiple items', async () => {
      expect(await contract.importAddresses([aName32, bName32], [ownerAddress, ownerAddress])).not.throw;
    });

    it('expect to throw when uneven number of inputs', async () => {
      await expect(contract.importAddresses([aName32, bName32], [ownerAddress])).to.reverted;

      await expect(contract.importAddresses([aName32], [ownerAddress, ownerAddress])).to.reverted;
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
        expect(await contract.getAddress(toBytes32('-----'))).to.eq(ethers.constants.AddressZero);
      });
    });

    describe('requireAndGetAddress()', () => {
      it('expect to return valid address', async () => {
        expect(await contract.requireAndGetAddress(toBytes32(registrableName))).to.eq(registrable.address);
      });

      it('expect to throw when address not exists', async () => {
        await expect(contract.requireAndGetAddress(toBytes32('-----'))).to.be.reverted;
      });
    });
  });
});
