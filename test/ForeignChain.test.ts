import 'hardhat';
import '@nomiclabs/hardhat-ethers';

import hre from 'hardhat';
import { expect, use } from 'chai';
import { Contract } from 'ethers';
import { waffleChai } from '@ethereum-waffle/chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { doSnapshot, revertSnapshot } from '../scripts/utils/helpers';
import { blockTimestamp, mintBlocks } from './utils';
import { ChainStatus } from './types/ChainStatus';
import { prepareData, tree } from './chainUtils';
import { FOREIGN_CHAIN, STAKING_BANK_STATE } from '../constants';
import { registerChain } from '../tasks/_helpers/registerChain';
import { deployerSigner } from '../tasks/_helpers/jsonRpcProvider';

use(waffleChai);

const timePadding = 100;
const totalSupply = 100;

const root = tree.getRoot();

describe('ForeignChain @foreignchain', () => {
  let owner: SignerWithAddress, validator: SignerWithAddress, contract: Contract;

  let genesisSnapshotId: unknown;

  before(async () => {
    genesisSnapshotId = await doSnapshot(hre);
  });

  after(async () => {
    await revertSnapshot(hre, genesisSnapshotId);
  });

  beforeEach(async () => {
    const { deployments, ethers } = hre;
    [owner, validator] = await ethers.getSigners();

    await deployments.fixture(FOREIGN_CHAIN);
    const contractDeployments = await deployments.get(FOREIGN_CHAIN);

    await registerChain(hre);

    await deployments.execute(
      STAKING_BANK_STATE,
      { from: owner.address },
      'setBalances',
      [validator.address],
      [totalSupply],
      totalSupply
    );

    contract = new Contract(contractDeployments.address, contractDeployments.abi, hre.ethers.provider);
  });

  describe('when deployed', () => {
    it('#isForeign', async () => {
      expect(await contract.isForeign()).true;
    });

    it('not throw on status', async () => {
      await expect(contract.getStatus()).not.to.be.reverted;
    });
  });

  it('#getLeaderIndex throws', async () => {
    await expect(contract.getLeaderIndex(1, 2)).revertedWith('NotSupported');
  });

  it('#getLeaderAddressAtTime throws', async () => {
    await expect(contract.getLeaderAddressAtTime(1)).revertedWith('NotSupported');
  });

  it('expect to getStatus()', async () => {
    await mintBlocks(timePadding);
    const { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);
    await contract.connect(deployerSigner(hre)).submit(dataTimestamp, root, [], [], [v], [r], [s]);
    console.log(await contract.blocks(dataTimestamp));

    await mintBlocks(timePadding + 1);

    console.log(root);
    console.log(await contract.blocks(dataTimestamp));

    const status: ChainStatus = await contract.getStatus();

    expect(status.lastDataTimestamp).to.eq(dataTimestamp, 'invalid lastDataTimestamp');
    expect(status.lastId).to.eq(dataTimestamp, 'invalid block ID');
    // expect(status.nextBlockId).to.eq(dataTimestamp + timePadding + 1, 'invalid next block ID');
    expect(status.nextLeader).to.eq(hre.ethers.constants.AddressZero, 'validator should be empty');
    expect(status.validators).to.eql([], 'invalid validators list');
    expect(status.powers).to.eql([], 'invalid powers');
    expect(status.locations).to.eql([], 'invalid locations');
    expect(status.staked).to.eq(totalSupply, 'invalid staked');
    expect(status.minSignatures).to.eq(1, 'invalid requiredSignatures');
  });
});
