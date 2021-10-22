import 'hardhat'; // require for IntelliJ to run tests
import '@nomiclabs/hardhat-waffle'; // require for IntelliJ to run tests
import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';
import { use, expect } from 'chai';
import { BigNumber, Contract, ContractFactory, Signer } from 'ethers';
import { waffleChai } from '@ethereum-waffle/chai';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Distributor = require('../../artifacts/contracts/Distributor.sol/Distributor.json');

use(waffleChai);

const balanceOf = async (address: string): Promise<BigNumber> => ethers.provider.getBalance(address);

async function setup() {
  const [owner, recipient1] = await ethers.getSigners();
  const contractFactory = new ContractFactory(Distributor.abi, Distributor.bytecode, owner);

  const contract = await contractFactory.deploy([await recipient1.getAddress()]);

  return { contract, recipient1, owner };
}

describe('Distributor', () => {
  let contract: Contract;
  let owner: Signer;
  let recipient1: Signer;
  let recipient1Address: string;

  beforeEach(async () => {
    ({ contract, recipient1, owner } = await setup());
    recipient1Address = await recipient1.getAddress();
  });

  describe('when deployed', () => {
    it('expect to have recipient1', async () => {
      expect(await contract.recipientsCount()).to.eq(1);
    });

    it('expect to have recipient1 address', async () => {
      expect(await contract.recipients(0)).to.eq(recipient1Address);
    });
  });

  it('expect to manage recipient1 address', async () => {
    const wallet1 = ethers.Wallet.createRandom();

    await contract.addRecipients([wallet1.address]);

    expect(await contract.recipientsCount()).to.eq(2);
    expect(await contract.recipients(1)).to.eq(wallet1.address);

    await contract.removeRecipient(recipient1Address);

    expect(await contract.recipientsCount()).to.eq(1);
    expect(await contract.recipients(0)).to.eq(wallet1.address);
  });

  it('expect to manage limits', async () => {
    await contract.setLimits(2, 3);

    expect(await contract.bottomLimit()).to.eq(2);
    expect(await contract.topLimit()).to.eq(3);
  });

  describe('distribution', () => {
    it('expect to not send coins when recipient has more than limit', async () => {
      const balanceBefore = await recipient1.getBalance();
      await owner.sendTransaction({ to: contract.address, value: 100 });

      expect(await recipient1.getBalance()).to.gt(await contract.bottomLimit());
      expect(await recipient1.getBalance()).to.eq(balanceBefore);
    });

    it('expect to send coins when recipient has below limit', async () => {
      const wallet = ethers.Wallet.createRandom();
      await contract.addRecipients([wallet.address]);
      const topLimit = await contract.topLimit();
      await owner.sendTransaction({ to: contract.address, value: topLimit });

      expect(await balanceOf(wallet.address)).to.eq(topLimit);
    });

    it('not throw when contract has no balance', async () => {
      await expect(owner.sendTransaction({ to: contract.address, value: 1 })).not.throw;
    });

    it('expect withdraw to left some ETH just in case', async () => {
      const balanceBefore = await owner.getBalance();

      await owner.sendTransaction({ to: contract.address, value: '0x29A2241AF62C0000' });
      await contract.withdraw();

      expect(await owner.getBalance()).lt(balanceBefore);
      expect(await balanceOf(contract.address)).eq('500000000000000000');
    });

    it('expect to distribute coins to many', async () => {
      const wallet1 = ethers.Wallet.createRandom('1');
      const wallet2 = ethers.Wallet.createRandom('2');
      const wallet3 = ethers.Wallet.createRandom('3');

      const balances = await Promise.all([
        balanceOf(recipient1Address),
        balanceOf(wallet1.address),
        balanceOf(wallet2.address),
        balanceOf(wallet3.address),
      ]);

      const topLimit: BigNumber = await contract.topLimit();

      await contract.addRecipients([wallet1.address, wallet2.address, wallet3.address]);

      await owner.sendTransaction({ to: contract.address, value: topLimit.div(10).mul(15) });

      expect(await recipient1.getBalance()).to.eq(balances[0]);
      expect(await balanceOf(wallet1.address)).to.eq(topLimit, 'wallet1');
      expect(await balanceOf(wallet2.address)).to.eq(topLimit.div(2), 'wallet2');
      expect(await balanceOf(wallet3.address)).to.eq(0, 'wallet3');
    });
  });
});
