import {use, expect} from 'chai';
import {Contract, ContractFactory, Signer} from 'ethers';
import {waffleChai} from '@ethereum-waffle/chai';
import {loadFixture} from 'ethereum-waffle';

import ValidatorRegistry from '../../artifacts/contracts/ValidatorRegistry.sol/ValidatorRegistry.json';

use(waffleChai);

async function fixture([owner, validator]: Signer[]) {
  const contractFactory = new ContractFactory(ValidatorRegistry.abi, ValidatorRegistry.bytecode, owner);
  const contract = await contractFactory.deploy();

  return {
    owner,
    validatorAddress: await validator.getAddress(),
    contract
  };
}


describe('ValidatorRegistry', () => {
  let validatorAddress: string, contract: Contract;

  beforeEach(async () => {
    ({validatorAddress, contract} = await loadFixture(fixture));
  });

  describe('when deployed', () => {
    it('expect to have 0 validators', async () => {
      expect(await contract.getNumberOfValidators()).to.eq(0);
    });
  });

  describe('create()', () => {
    it('expect to creates validators', async () => {
      await expect(contract.create(validatorAddress, 'IP')).not.to.be.reverted;
    });

    describe('when created', () => {
      beforeEach(async () => {
        await contract.create(validatorAddress, 'IP');
      });

      it('expect to have 1 validator', async () => {
        expect(await contract.getNumberOfValidators()).to.eq(1);
      });

      it('expect addresses() to return validator', async () => {
        expect(await contract.addresses(0)).to.eq(validatorAddress);
      });

      it('expect to be removed', async () => {
        await expect(contract.remove(validatorAddress))
          .to.emit(contract, 'LogValidatorRemoved').withArgs(validatorAddress);
        expect(await contract.getNumberOfValidators()).to.eq(0);
      });
    });
  });
});
