import { use, expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { waffleChai } from '@ethereum-waffle/chai';
import { Contract, ContractFactory } from 'ethers';

import Token from '../../artifacts/contracts/LimitedMintingToken.sol/LimitedMintingToken.json';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

use(waffleChai);

const DAILY_ALLOWANCE = '10000000000000000000';

async function setup() {
  const [owner, wallet1] = await ethers.getSigners();
  const contractFactory = new ContractFactory(Token.abi, Token.bytecode, owner);

  const contract = await contractFactory.deploy('Umbrella', 'UMB', DAILY_ALLOWANCE);
  await contract.deployed();

  return { contract, owner, wallet1 };
}

describe('LimitedMintingToken', () => {
  let contract: Contract;
  let owner: SignerWithAddress;
  let wallet1: SignerWithAddress;

  beforeEach(async () => {
    ({ contract, owner, wallet1 } = await setup());
  });

  describe('minting less than the dailyAllowance', () => {
    it('mints the desired amount', async () => {
      const tx = await contract.connect(owner).mint(owner.address, '9' + '0'.repeat(18));
      await tx.wait();

      const balance = await contract.balanceOf(owner.address);

      expect(balance).to.equal('9000000000000000000');
    });
  });

  describe('when asking to mint more than the dailyAllowance', () => {
    it('mints the dailyAllowance', async () => {
      const tx = await contract.connect(owner).mint(owner.address, '11' + '0'.repeat(18));
      await tx.wait();

      const balance = await contract.balanceOf(owner.address);

      expect(balance).to.equal(DAILY_ALLOWANCE);
    });
  });

  describe('when minting your partial allowance', () => {
    it('allows to mint multiple times a day', async () => {
      let tx = await contract.connect(owner).mint(owner.address, '5' + '0'.repeat(18));
      await tx.wait();
      tx = await contract.connect(owner).mint(owner.address, '5' + '0'.repeat(18));
      await tx.wait();

      const balance = await contract.balanceOf(owner.address);

      expect(balance).to.equal(DAILY_ALLOWANCE);
    });
  });

  describe('when partial minting exceeds dailyAllowance', () => {
    it('mints up to the dailyAllowance', async () => {
      let tx = await contract.connect(owner).mint(owner.address, '5' + '0'.repeat(18));
      await tx.wait();
      tx = await contract.connect(owner).mint(owner.address, '6' + '0'.repeat(18));
      await tx.wait();

      const balance = await contract.balanceOf(owner.address);

      expect(balance).to.equal(DAILY_ALLOWANCE);
    });
  });

  describe('when wallet already minted dailyAllowance', () => {
    describe('when insisting on minting without free limit', () => {
      it('reverts with message', async () => {
        const tx = await contract.connect(owner).mint(owner.address, DAILY_ALLOWANCE);
        await tx.wait();

        await expect(contract.connect(owner).mint(owner.address, '1')).to.be.revertedWith(
          'This address already claimed the maximum daily amount'
        );
      });
    });

    describe('when another signer mints', () => {
      it('allows minting to address', async () => {
        let tx = await contract.connect(owner).mint(owner.address, DAILY_ALLOWANCE);
        await tx.wait();
        tx = await contract.connect(wallet1).mint(owner.address, DAILY_ALLOWANCE);
        await tx.wait();

        const balance = await contract.balanceOf(owner.address);

        expect(balance).to.equal('20' + '0'.repeat(18));
      });
    });

    describe('after 24 hours', () => {
      it('allows minting again', async () => {
        let tx = await contract.connect(owner).mint(owner.address, DAILY_ALLOWANCE);
        await tx.wait();

        const oneDayInSeconds = 60 * 60 * 24 + 1;
        await hre.network.provider.send('evm_increaseTime', [oneDayInSeconds]);

        tx = await contract.connect(owner).mint(owner.address, DAILY_ALLOWANCE);
        await tx.wait();

        const balance = await contract.balanceOf(owner.address);
        expect(balance).to.equal('20' + '0'.repeat(18));
      });
    });
  });

  describe('#setDailyAllowance', () => {
    const newAllowance = '15000000000000000000';

    describe('when caller is the owner', () => {
      it('sets the new dailyAllowance', async () => {
        const tx = await contract.connect(owner).setDailyAllowance(newAllowance);
        await tx.wait();

        expect(await contract.getDailyAllowance()).to.equal(newAllowance);
      });
    });

    describe('when caller is not the owner', () => {
      it('rejects the call', async () => {
        await expect(contract.connect(wallet1).setDailyAllowance(newAllowance)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
    });
  });
});
