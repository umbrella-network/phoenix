import 'hardhat';
import '@nomiclabs/hardhat-ethers';

import { use, expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract, ContractFactory, Signer } from 'ethers';
import { waffleChai } from '@ethereum-waffle/chai';
import { deployMockContract, MockContract } from '@ethereum-waffle/mock-contract';
import Registry from '../../artifacts/contracts/Registry.sol/Registry.json';
import StakingBank from '../../artifacts/contracts/StakingBank.sol/StakingBank.json';
import Token from '../../artifacts/contracts/Token.sol/Token.json';
import { toBytes32 } from '../../scripts/utils/helpers';

use(waffleChai);

async function fixture() {
  const [owner, validator1, validator2] = await ethers.getSigners();
  const contractRegistry = await deployMockContract(owner, Registry.abi);
  const token = await deployMockContract(owner, Token.abi);
  const contractFactory = new ContractFactory(StakingBank.abi, StakingBank.bytecode, owner);

  await token.mock.name.returns('abc');
  await token.mock.symbol.returns('abc');

  const contract = await contractFactory.deploy(contractRegistry.address, 'Umbrella', 'UMB');

  return {
    owner,
    validator1,
    validatorAddress: await validator1.getAddress(),
    validator2Address: await validator2.getAddress(),
    contract,
    token,
    contractRegistry,
  };
}

describe('StakingBank', () => {
  let contract: Contract;

  beforeEach(async () => {
    ({ contract } = await fixture());
  });

  describe('when deployed', () => {
    it('expect to have name', async () => {
      expect(await contract.getName()).to.eq(toBytes32('StakingBank'));
    });
  });
});

describe('ValidatorRegistry', () => {
  let contract: Contract;
  let token: MockContract;
  let contractRegistry: MockContract;
  let validatorAddress: string, validator2Address: string;
  let validator1: Signer;

  beforeEach(async () => {
    ({ validatorAddress, validator2Address, contract, validator1, token, contractRegistry } = await fixture());
  });

  describe('when deployed', () => {
    it('expect to have 0 validators', async () => {
      expect(await contract.getNumberOfValidators()).to.eq(0);
    });
  });

  describe('create()', () => {
    it('expect to creates validators', async () => {
      await expect(contract.create(validatorAddress, 'IP')).not.to.be.reverted;
      await expect(contract.create(validator2Address, 'IP2')).not.to.be.reverted;
    });

    describe('when created', () => {
      beforeEach(async () => {
        await contract.create(validatorAddress, 'IP');
        await contract.create(validator2Address, 'IP2');
      });

      it('expect to have 2 validator', async () => {
        expect(await contract.getNumberOfValidators()).to.eq(2);
      });

      it('expect addresses() to return validator', async () => {
        expect(await contract.addresses(0)).to.eq(validatorAddress);
        expect(await contract.addresses(1)).to.eq(validator2Address);
      });

      it('expect to be removed', async () => {
        await expect(contract.remove(validatorAddress))
          .to.emit(contract, 'LogValidatorRemoved')
          .withArgs(validatorAddress);

        expect(await contract.getNumberOfValidators()).to.eq(1);
      });

      describe('when stake', () => {
        beforeEach('expect to stake', async () => {
          await contractRegistry.mock.requireAndGetAddress.withArgs(toBytes32('UMB')).returns(token.address);
          await token.mock.allowance.withArgs(validatorAddress, contract.address).returns(25);
          await token.mock.transferFrom.withArgs(validatorAddress, contract.address, 25).returns(true);

          expect(await contract.totalSupply()).to.eq(0);
          await contract.receiveApproval(validatorAddress);
        });

        it('expect to have totalSupply', async () => {
          expect(await contract.totalSupply()).to.eq(25);
        });

        it('can not transfer tokens', async () => {
          await expect(contract.connect(validator1).transfer(validator2Address, 10)).to.revertedWith(
            'staked tokens can not be transferred'
          );
        });

        it('expect to unstake when removed', async () => {
          await token.mock.transfer.withArgs(validatorAddress, 25).returns(true);

          await expect(contract.remove(validatorAddress))
            .to.emit(contract, 'LogValidatorRemoved')
            .withArgs(validatorAddress);

          expect(await contract.getNumberOfValidators()).to.eq(1);
          expect(await contract.totalSupply()).to.eq(0);
        });
      });
    });
  });
});
