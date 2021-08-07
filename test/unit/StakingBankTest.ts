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

const defaultMinAmount = 1000;

async function fixture(minAmount = defaultMinAmount) {
  const [owner, validator1, validator2] = await ethers.getSigners();
  const contractRegistry = await deployMockContract(owner, Registry.abi);
  const token = await deployMockContract(owner, Token.abi);
  await contractRegistry.mock.requireAndGetAddress.withArgs(toBytes32('UMB')).returns(token.address);
  const contractFactory = new ContractFactory(StakingBank.abi, StakingBank.bytecode, owner);

  await token.mock.name.returns('abc');
  await token.mock.symbol.returns('abc');

  const contract = await contractFactory.deploy(contractRegistry.address, minAmount, 'Umbrella', 'UMB');

  return {
    owner,
    validator1,
    validator2,
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

    it('expect to have min amount to stake', async () => {
      expect(await contract.minAmountForStake()).to.eq(1000);
    });

    it('expect to change min amount to stake', async () => {
      const limit = 3333;
      await expect(contract.setMinAmountForStake(limit)).to.emit(contract, 'LogMinAmountForStake').withArgs(limit);

      expect(await contract.minAmountForStake()).to.eq(limit);
    });

    it('min amount to stake must be > 0', async () => {
      await expect(contract.setMinAmountForStake(0)).to.revertedWith('must be positive');
      await expect(contract.setMinAmountForStake(1)).not.to.throw;
    });
  });
});

describe('ValidatorRegistry', () => {
  let contract: Contract;
  let token: MockContract;
  let validatorAddress: string, validator2Address: string;
  let validator1: Signer;

  beforeEach(async () => {
    ({ validatorAddress, validator2Address, contract, validator1, token } = await fixture());
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

      it('throw when stake less than required minimum', async () => {
        const toStake = defaultMinAmount - 1;
        await token.mock.allowance.withArgs(validatorAddress, contract.address).returns(toStake);
        await token.mock.transferFrom.withArgs(validatorAddress, contract.address, toStake).returns(true);

        expect(await contract.totalSupply()).to.eq(0);
        await expect(contract.receiveApproval(validatorAddress)).to.revertedWith('_amount is too low');
        await expect(contract.connect(validator1).stake(toStake)).to.revertedWith('_amount is too low');
      });

      it('expect to receiveApproval when amount is at least minimum', async () => {
        const toStake = defaultMinAmount;
        await token.mock.allowance.withArgs(validatorAddress, contract.address).returns(toStake);
        await token.mock.transferFrom.withArgs(validatorAddress, contract.address, toStake).returns(true);

        expect(await contract.totalSupply()).to.eq(0);
        await expect(contract.receiveApproval(validatorAddress)).not.throw;
      });

      it('expect to stake when amount is at least minimum', async () => {
        const toStake = defaultMinAmount;
        await token.mock.allowance.withArgs(validatorAddress, contract.address).returns(toStake);
        await token.mock.transferFrom.withArgs(validatorAddress, contract.address, toStake).returns(true);

        expect(await contract.totalSupply()).to.eq(0);
        await expect(contract.connect(validator1).stake(toStake)).not.throw;
      });

      describe('when staked', () => {
        const staked = defaultMinAmount + 1;

        beforeEach('expect to stake', async () => {
          await token.mock.allowance.withArgs(validatorAddress, contract.address).returns(staked);
          await token.mock.transferFrom.withArgs(validatorAddress, contract.address, staked).returns(true);

          expect(await contract.totalSupply()).to.eq(0);
          await contract.connect(validator1).stake(staked);
        });

        it('expect to have totalSupply', async () => {
          expect(await contract.totalSupply()).to.eq(staked);
        });

        it('expect to withdraw', async () => {
          await token.mock.transfer.withArgs(validatorAddress, 1).returns(true);

          await contract.connect(validator1).withdraw(1);
          expect(await contract.totalSupply()).to.eq(staked - 1);
        });

        it('expect to withdraw all', async () => {
          await token.mock.transfer.withArgs(validatorAddress, staked).returns(true);

          await contract.connect(validator1).exit();
          expect(await contract.totalSupply()).to.eq(0);
        });

        it('expect to throw when minAmountForStake is not left as staked amount', async () => {
          await expect(contract.connect(validator1).withdraw(2)).to.revertedWith('minAmountForStake must be available');
        });

        it('can not transfer tokens', async () => {
          await expect(contract.connect(validator1).transfer(validator2Address, 10)).to.revertedWith(
            'staked tokens can not be transferred'
          );
        });

        it('expect to unstake when removed', async () => {
          await token.mock.transfer.withArgs(validatorAddress, staked).returns(true);

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
