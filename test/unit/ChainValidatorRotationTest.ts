import {BigNumber, Contract, Signer} from 'ethers';
import {waffleChai} from '@ethereum-waffle/chai';
import {expect, use} from 'chai';
import {ethers} from 'hardhat';

import ValidatorRegistry from '../../artifacts/contracts/ValidatorRegistry.sol/ValidatorRegistry.json';
import {deployMockContract} from '@ethereum-waffle/mock-contract';
import Registry from '../../artifacts/contracts/Registry.sol/Registry.json';
import StakingBank from '../../artifacts/contracts/StakingBank.sol/StakingBank.json';
import {toBytes32} from '../../scripts/utils/helpers';
import {Address} from 'hardhat-deploy/dist/types';

use(waffleChai);

describe('ChainValidatorRotation', () => {
  let owner: Signer,
    validators: Address[],
    chain: Contract,
    blockPadding: number;

  const submit = async <T>(leader: Address): Promise<T> => {
    const signers = await ethers.getSigners();

    const signer = signers.find(({address}) => address === leader);

    if (!signer) {
      return Promise.reject(`No signer for address ${leader}`);
    }

    const blockHeight = await chain.getBlockHeight(), root = ethers.constants.HashZero;

    const {r, s, v} = await prepareData(owner, blockHeight.toNumber(), root);

    return chain.connect(signer).submit(root, [], [], [v], [r], [s]);
  };

  /*
  describe('no validators', () => {
    beforeEach(async () => {
      return ({owner, validators, chain} = await setup(8, 0));
    });

    it('getLeaderAddress returns zero address', async () => {
      expect(await chain.getLeaderAddress()).to.equal(ethers.constants.AddressZero);
    });
  });
*/
  describe('single validator', () => {
    beforeEach(async () => {
      return ({owner, validators, chain, blockPadding} = await setup(8, 1));
    });

    it('getLeaderAddress returns address of a single validator', async () => {
      expect(await chain.getLeaderAddress()).to.equal(validators[0]);
    });

    it('a single validator submits blocks after blockPadding', async () => {
      expect(await chain.getLeaderAddress()).to.equal(validators[0]);

      // submit first block
      await expect(submit(validators[0])).to.emit(chain, 'LogMint');

      await mineManyBlocks(blockPadding + 1);

      await expect(submit(validators[0])).to.emit(chain, 'LogMint');
    });
  });

  describe('two validators rotate after block submission', () => {
    beforeEach(async () => {
      return ({owner, validators, chain, blockPadding} = await setup(8, 2));
    });

    it('validators submit 2 blocks', async () => {
      const leader1Index = validators.indexOf(await chain.getLeaderAddress());
      await expect(submit(validators[leader1Index])).to.emit(chain, 'LogMint');
      await mineManyBlocks(blockPadding + 1);

      const leader2Index = validators.indexOf(await chain.getLeaderAddress());
      await expect(submit(validators[leader2Index])).to.emit(chain, 'LogMint');
    });
  });

  describe('5 validators rotate after block submission', () => {
    beforeEach(async () => {
      return ({owner, validators, chain, blockPadding} = await setup(8, 5));
    });

    it('validators submit 2 blocks', async () => {
      for (let i = 0; i < 10; ++i) {
        const {number} = await mineBlock(Math.floor(Math.random() * 100) + 1);
        const leader = await chain.getLeaderAddress();

        console.log(`block ${number}: validator ${validators.indexOf(leader)}`);

        await expect(submit(leader)).to.emit(chain, 'LogMint');

        await mineManyBlocks(8);
      }
    }).timeout(10000000);
  });
});


const setup = async (blockPadding: number, numValidators: number) => {
  const [owner, ...validators] = await ethers.getSigners();

  const validatorRegistry = await deployMockContract(owner, ValidatorRegistry.abi);
  const contractRegistry = await deployMockContract(owner, Registry.abi);
  const stakingBank = await deployMockContract(owner, StakingBank.abi);

  await contractRegistry.mock.getAddress.withArgs(toBytes32('ValidatorRegistry')).returns(validatorRegistry.address);
  await contractRegistry.mock.requireAndGetAddress.withArgs(toBytes32('ValidatorRegistry'))
    .returns(validatorRegistry.address);

  await contractRegistry.mock.requireAndGetAddress.withArgs(toBytes32('StakingBank'))
    .returns(stakingBank.address);

  await stakingBank.mock.totalSupply.withArgs().returns(BigNumber.from(10));
  await stakingBank.mock.balanceOf.withArgs(owner.address).returns(BigNumber.from(10));

  await contractRegistry.mock.getAddress.withArgs(toBytes32('Chain')).returns(ethers.constants.AddressZero);

  await validatorRegistry.mock.getNumberOfValidators.withArgs().returns(numValidators);

  for (let i = 0; i < numValidators; ++i) {
    await validatorRegistry.mock.addresses.withArgs(i).returns(validators[i].address);
  }

  const contract = await ethers.getContractFactory('Chain');

  const chain = await contract.deploy(
    contractRegistry.address,
    blockPadding,
  );

  return {
    validators: validators.map(({address}) => address),
    owner,
    chain,
    blockPadding,
  };
};

const delay = async (timeout: number) => {
  await new Promise((done) => setTimeout(done, timeout));
};

const mineBlock = async (increaseTime = 1) => {
  const {timestamp, number} = await ethers.provider.getBlock('latest');
  await ethers.provider.send('evm_mine', [timestamp + increaseTime]);
  return {number: number + 1, timestamp: timestamp + increaseTime};
};

const mineManyBlocks = async (numBlocks: number) => {
  const tasks = [];
  for (let i = 0; i < numBlocks; ++i) {
    tasks.push(ethers.provider.send('evm_mine', []));
  }

  await Promise.all(tasks);

  const {timestamp, number} = await ethers.provider.getBlock('latest');
  return {number, timestamp};
};

const prepareData = async (
  signer: Signer,
  blockHeight: number,
  root: string | null,
  fcdKeys: string[] = [],
  fcdValues: number[] = []
) => {
  let testimony = ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes32'], [blockHeight, root]);

  for (let i = 0; i < fcdKeys.length; i++) {
    testimony += ethers.utils.defaultAbiCoder.encode(['bytes32', 'uint256'], [fcdKeys[i], fcdValues[i]]).slice(2);
  }

  const hashForSolidity = ethers.utils.keccak256(testimony);
  const affidavit = ethers.utils.arrayify(hashForSolidity);

  const sig = await signer.signMessage(affidavit);
  const {r, s, v} = ethers.utils.splitSignature(sig);


  return {testimony, affidavit, sig, r, s, v, hashForSolidity};
};
