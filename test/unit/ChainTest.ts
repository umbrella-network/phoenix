import 'hardhat';
import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';
import { expect, use } from 'chai';
import { BigNumber, Contract, ContractFactory, Signer } from 'ethers';
import { waffleChai } from '@ethereum-waffle/chai';
import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { LeafKeyCoder, LeafValueCoder } from '@umb-network/toolbox';
import { remove0x } from '@umb-network/toolbox/dist/utils/helpers';

import SortedMerkleTree from '../../lib/SortedMerkleTree';

import Registry from '../../artifacts/contracts/Registry.sol/Registry.json';
import Chain from '../../artifacts/contracts/Chain.sol/Chain.json';
import StakingBank from '../../artifacts/contracts/StakingBank.sol/StakingBank.json';
import Token from '../../artifacts/contracts/Token.sol/Token.json';
import { toBytes32 } from '../../scripts/utils/helpers';
import { blockTimestamp, mintBlocks } from '../utils';
import { ChainStatus } from '../types/ChainStatus';

use(waffleChai);

const timePadding = 100;

const setup = async () => {
  const [owner, validator] = await ethers.getSigners();
  const token = await deployMockContract(owner, Token.abi);
  const contractRegistry = await deployMockContract(owner, Registry.abi);
  const stakingBank = await deployMockContract(owner, StakingBank.abi);
  const contractFactory = new ContractFactory(Chain.abi, Chain.bytecode, owner);

  await contractRegistry.mock.getAddress.withArgs(toBytes32('Chain')).returns(ethers.constants.AddressZero);

  const contract = await contractFactory.deploy(contractRegistry.address, timePadding);

  return {
    owner,
    validator,
    validatorAddress: await validator.getAddress(),
    token,
    contractRegistry,
    stakingBank,
    contract,
    contractFactory,
  };
};

const inputs: Record<string, Buffer> = {};

const keys = [
  'ETH-EUR',
  'BTC-EUR',
  'WAR-EUR',
  'LTC-EUR',
  'UNI-EUR',
  'ETH-USD',
  'BTC-USD',
  'WAR-USD',
  'LTC-USD',
  'UNI-USD',
];

keys.forEach((k, i) => {
  inputs[k] = LeafValueCoder.encode(i + 1, 'label');
});

const tree = new SortedMerkleTree(inputs);
const root = tree.getRoot();

const abiUintEncoder = (n: number | string, bits = 256): string =>
  (typeof n === 'number' ? n.toString(16) : remove0x(n)).padStart(bits / 4, '0');

const prepareData = async (
  signer: Signer,
  dataTimestamp: number,
  root: string | null,
  fcdKeys: string[] = [],
  fcdValues: (number | string)[] = []
) => {
  let testimony = '0x' + abiUintEncoder(dataTimestamp, 32) + root?.replace('0x', '');

  for (let i = 0; i < fcdKeys.length; i++) {
    if (typeof fcdValues[i] === 'string' && !ethers.utils.isHexString(fcdValues[i])) {
      throw Error(`if FCD is a string, then must be hex string: ${fcdValues[i]}`);
    }

    testimony += fcdKeys[i].replace('0x', '') + abiUintEncoder(fcdValues[i]);
  }

  const hashForSolidity = ethers.utils.keccak256(testimony);
  const affidavit = ethers.utils.arrayify(hashForSolidity);

  const sig = await signer.signMessage(affidavit);
  const { r, s, v } = ethers.utils.splitSignature(sig);

  return { testimony, affidavit, sig, r, s, v, hashForSolidity, dataTimestamp };
};

describe('Chain', () => {
  let owner: Signer,
    validator: Signer,
    validatorAddress: string,
    contractRegistry: Contract,
    stakingBank: Contract,
    contract: Contract,
    contractFactory: ContractFactory;

  const mockSubmit = async (leader = validator, totalSupply = 1000, balance = 1000) => {
    await contractRegistry.mock.requireAndGetAddress.withArgs(toBytes32('StakingBank')).returns(stakingBank.address);
    await stakingBank.mock.totalSupply.returns(totalSupply);
    await stakingBank.mock.balanceOf.withArgs(await leader.getAddress()).returns(balance);
  };

  const executeSubmit = async (blockId: number, dataTimestamp: number) => {
    await mockSubmit();
    const { r, s, v } = await prepareData(validator, dataTimestamp, root);
    await contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]);
  };

  beforeEach(async () => {
    return ({
      owner,
      validator,
      validatorAddress,
      contractRegistry,
      stakingBank,
      contract,
      contractFactory,
    } = await setup());
  });

  describe('when deployed', () => {
    it('expect to have padding', async () => {
      expect(await contract.padding()).to.eq(timePadding);
    });

    it('expect to have no blocks', async () => {
      expect(await contract.blocksCount()).to.eq(0);
    });

    it('expect to blockId to be 0', async () => {
      expect(await contract.getBlockId()).to.eq(0);
    });

    it('not throw on status', async () => {
      await contractRegistry.mock.requireAndGetAddress.withArgs(toBytes32('StakingBank')).returns(stakingBank.address);

      await stakingBank.mock.getNumberOfValidators.returns(0);
      await contractRegistry.mock.requireAndGetAddress.withArgs(toBytes32('StakingBank')).returns(stakingBank.address);
      await stakingBank.mock.totalSupply.returns(0);

      await expect(contract.getStatus()).not.to.be.reverted;
    });
  });

  describe('setPadding()', () => {
    it('expect to set block padding', async () => {
      await expect(contract.setPadding(9))
        .to.emit(contract, 'LogPadding')
        .withArgs(await owner.getAddress(), 9);

      expect(await contract.padding()).to.eq(9);
    });

    it('expect to throw when call from NOT an owner', async () => {
      await expect(contract.connect(validator).setPadding(9)).to.revertedWith('caller is not the owner');
    });
  });

  describe('recoverSigner()', () => {
    it('expect to return signer', async () => {
      const { sig, affidavit, r, s, v, hashForSolidity } = await prepareData(validator, 1, root);

      const signer = await contract.recoverSigner(hashForSolidity, v, r, s);

      expect(signer).to.eq(validatorAddress);
      expect(await ethers.utils.verifyMessage(affidavit, sig)).to.eq(validatorAddress);
    });
  });

  describe('bytesToBytes32Array()', () => {
    it('expect to convert bytes to array of bytes32', async () => {
      const arr = ['1', '2', '3'].map((str) => `0x${str.padStart(64, '0')}`);
      const bytes = '0x' + arr.map((item) => item.slice(2)).join('');
      expect(await contract.bytesToBytes32Array(bytes, 0, arr.length)).to.eql(arr);
    });

    it('expect to slice bytes by offset', async () => {
      const arr = ['1', '2', '3'].map((str) => `0x${str.padStart(64, '0')}`);
      const bytes = '0x' + arr.map((item) => item.slice(2)).join('');
      expect(await contract.bytesToBytes32Array(bytes, 2, 1)).to.eql([arr[2]]);
    });
  });

  describe('.getLeaderIndex()', () => {
    [1, 2, 3, 4].forEach((numberOfValidators) => {
      it(`expect to return valid index for ${numberOfValidators}`, async () => {
        return;
        const id = await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber());

        expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
          id,
          'round #1'
        );
        await mintBlocks(timePadding);
        expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
          (id + 1) % numberOfValidators,
          'round #2'
        );
        await mintBlocks(timePadding);
        expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
          (id + 2) % numberOfValidators,
          'round #3'
        );
        await mintBlocks(timePadding);
        expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
          (id + 3) % numberOfValidators,
          'round #4'
        );
      });
    });

    describe('when block was minted', () => {
      beforeEach(async () => {
        await executeSubmit(0, await blockTimestamp());
      });

      [1, 2, 3, 4].forEach((numberOfValidators) => {
        it(`expect to return valid index for ${numberOfValidators}`, async () => {
          return;
          const id = await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber());

          expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
            id,
            'round #1'
          );
          await mintBlocks(timePadding);
          expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
            (id + 1) % numberOfValidators,
            'round #2'
          );
          await mintBlocks(timePadding);
          expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
            (id + 2) % numberOfValidators,
            'round #3'
          );
          await mintBlocks(timePadding);
          expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
            (id + 3) % numberOfValidators,
            'round #4'
          );
        });
      });
    });
  });

  describe('.submit()', () => {
    describe('without FCD', () => {
      it('expect to mint a block', async () => {
        await mockSubmit();
        const { r, s, v, dataTimestamp, testimony } = await prepareData(validator, await blockTimestamp(), root);

        console.log({ testimony });
        await expect(contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s])).not.to.be.reverted;
        console.log(await contract.blocks(0));
      });

      it('fail when signature do not match', async () => {
        await mockSubmit();
        const { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);

        const differentRoot = '0x0000000000000000000000000000000000000000000000000000000000000001';
        await expect(contract.connect(validator).submit(dataTimestamp, differentRoot, [], [], [v], [r], [s]))
          .to.be // recover sig will return some other address than validator, so mock function will fail
          .revertedWith('Mock on the method is not initialized');
      });

      describe('check the future dataTimestamp', () => {
        it('NOT failing when timestamp in acceptable range', async () => {
          await mockSubmit();
          const t = await blockTimestamp();

          const { r, s, v, dataTimestamp } = await prepareData(validator, t + 4, root);

          await expect(contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s])).not.to.be
            .reverted;
        });

        it('throw when timestamp NOT in acceptable range', async () => {
          return;
          // temporary remove this condition, because recently on ropsten we see cases when minter/node
          // can be even 100sec behind

          await mockSubmit();
          const t = await blockTimestamp();

          const { r, s, v, dataTimestamp } = await prepareData(validator, t + 5, root);

          await expect(
            contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s])
          ).to.be.revertedWith('oh, so you can predict the future:                               4');
        });
      });

      it('generates LogMint event', async () => {
        await mockSubmit();
        const { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);

        await expect(contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]))
          .to.emit(contract, 'LogMint')
          .withArgs(validatorAddress, 0, 1000, 1000);
      });

      it('generates LogVoter event', async () => {
        await mockSubmit();
        const { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);

        await expect(contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]))
          .to.emit(contract, 'LogVoter')
          .withArgs(0, validatorAddress, 1000);
      });

      describe('when block submitted', () => {
        let previousDataTimestamp: number;

        beforeEach(async () => {
          await mockSubmit();
          const { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);
          previousDataTimestamp = dataTimestamp;
          await contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]);
          await mintBlocks(1);
        });

        it('expect blockId to change ONLY when minimal padding reached', async () => {
          const lastDataTimestamp: number = await contract.getBlockTimestamp(0);

          while ((await blockTimestamp()) <= lastDataTimestamp + timePadding) {
            expect(await contract.getBlockId()).to.eq(0);
            await mintBlocks(1);
          }

          expect(await contract.getBlockId()).to.eq(1);
        });

        it('expect getBlockIdAtTimestamp return valid ID', async () => {
          const lastDataTimestamp: number = await contract.getBlockTimestamp(0);

          expect(await contract.getBlockIdAtTimestamp(lastDataTimestamp)).to.eq(0);
          expect(await contract.getBlockIdAtTimestamp(lastDataTimestamp + timePadding)).to.eq(0);
          expect(await contract.getBlockIdAtTimestamp(lastDataTimestamp + timePadding + 1)).to.eq(1);
        });

        it('expect to have 1 block', async () => {
          expect(await contract.blocksCount()).to.eq(1);
        });

        it('expect to save valid root', async () => {
          expect((await contract.blocks(0)).root).to.eq(tree.getRoot());
        });

        it('expect to have no current FCD', async () => {
          const bytes32 = `0x${abiUintEncoder(0)}`;
          const fcds = await contract.getCurrentValues([bytes32]);
          expect(fcds[0].map((f: BigNumber) => f.toString())).to.eql(['0']);
          expect(fcds[1]).to.eql([0]);
        });

        it('fail when data NOT newer than previous block', async () => {
          await mintBlocks(timePadding);
          await mockSubmit();
          const { r, s, v, dataTimestamp } = await prepareData(validator, previousDataTimestamp, root);

          await expect(
            contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s])
          ).to.be.revertedWith('can NOT submit older data');
        });

        describe('verify Proof', () => {
          const k = 'BTC-USD';
          const v = inputs[k];
          const proof = tree.getProofForKey(k);

          it('.verifyProofForBlock()', async () => {
            expect(await contract.verifyProofForBlock(0, proof, LeafKeyCoder.encode(k), v)).to.be.true;
          });
        });

        describe('verifyProofs()', () => {
          it('expect to validate multiple proofs as once', async () => {
            const keys = Object.keys(inputs).slice(-3);
            const blockIds = new Array(keys.length).fill(0);
            const { proofs, proofItemsCounter } = tree.getFlatProofsForKeys(keys);
            const leaves = keys.map((k) => tree.getLeafForKey(k));
            const result = new Array(keys.length).fill(true);

            expect(await contract.verifyProofs(blockIds, proofs, proofItemsCounter, leaves)).to.eql(result);
          });
        });

        describe('when still on the same block ID', () => {
          it('expect submit to be reverted', async () => {
            await mockSubmit();
            const { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);
            await expect(
              contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s])
            ).to.revertedWith('do not spam');
          });

          describe('when minimal padding reached', () => {
            beforeEach(async () => {
              await contract.setPadding(0);
            });

            it('expect blockId to change', async () => {
              expect(await contract.getBlockId()).to.eq(1);
            });

            describe('when block mined for new blockId', () => {
              beforeEach(async () => {
                await contract.setPadding(1);
                await executeSubmit(1, await blockTimestamp());
                await contract.setPadding(100);
              });

              it('expect to revert when submit again for same block', async () => {
                await mockSubmit();
                const { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);
                await expect(
                  contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s])
                ).to.revertedWith('do not spam');
              });
            });
          });
        });
      });
    });

    describe('with FCD', () => {
      const fcdKeys = [toBytes32('a'), toBytes32('b')];
      const fcdValues = [1, 2];
      let submittedDataTimestamp: number;

      it('accept max FCD value', async () => {
        await mockSubmit();
        const values = [1, '0x' + 'F'.repeat(56)];

        const { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root, fcdKeys, values);

        await expect(contract.submit(dataTimestamp, root, fcdKeys, values, [v], [r], [s])).to.not.be.reverted;
      });

      it('throw when FCD overflows', async () => {
        await mockSubmit();
        const values = [1, '0x01' + 'F'.repeat(56)];

        const { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root, fcdKeys, values);

        await expect(contract.submit(dataTimestamp, root, fcdKeys, values, [v], [r], [s])).to.be.reverted;
      });

      describe('when block submitted', () => {
        beforeEach(async () => {
          await mockSubmit();
          const { r, s, v, dataTimestamp } = await prepareData(
            validator,
            await blockTimestamp(),
            root,
            fcdKeys,
            fcdValues
          );

          submittedDataTimestamp = dataTimestamp;

          await expect(
            contract.connect(validator).submit(dataTimestamp, root, fcdKeys, fcdValues, [v], [r], [s])
          ).to.emit(contract, 'LogMint');
        });

        it('expect to get FCD by key', async () => {
          const fcd = await contract.getCurrentValue(fcdKeys[0]);
          expect(fcd.map((f: BigNumber) => f.toString())).to.eql([
            fcdValues[0].toFixed(0),
            submittedDataTimestamp.toFixed(0),
          ]);
        });

        it('expect to get many FCDs', async () => {
          const fcds = await contract.getCurrentValues(fcdKeys);

          const expected = [
            [fcdValues[0].toFixed(0), fcdValues[1].toFixed(0)],
            [submittedDataTimestamp, submittedDataTimestamp],
          ];

          expect(fcds[0].map((f: BigNumber) => f.toString())).to.eql(expected[0]);
          expect(fcds[1]).to.eql(expected[1]);
        });

        it('expect to validate proof for selected key-value pair', async () => {
          const k = 'BTC-USD';
          const v = inputs[k];
          const proof = tree.getProofForKey(k);

          expect(await contract.verifyProofForBlock(0, proof, LeafKeyCoder.encode(k), v)).to.be.true;
        });
      });
    });
  });

  it('expect to getStatus()', async () => {
    await mintBlocks(timePadding);
    await mockSubmit();
    let { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);
    await contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]);

    await mintBlocks(timePadding);
    await mockSubmit();
    ({ r, s, v, dataTimestamp } = await prepareData(validator, dataTimestamp + 1, root));
    await contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]);

    await contractRegistry.mock.requireAndGetAddress.withArgs(toBytes32('StakingBank')).returns(stakingBank.address);
    await stakingBank.mock.getNumberOfValidators.returns(1);
    await stakingBank.mock.addresses.withArgs(0).returns(validatorAddress);
    await stakingBank.mock.validators.withArgs(validatorAddress).returns(validatorAddress, 'abc');
    await contractRegistry.mock.requireAndGetAddress.withArgs(toBytes32('StakingBank')).returns(stakingBank.address);
    await stakingBank.mock.totalSupply.returns(123);
    await stakingBank.mock.balanceOf.withArgs(validatorAddress).returns(321);

    await mintBlocks(timePadding);

    const status: ChainStatus = await contract.getStatus();

    expect(status.lastDataTimestamp).to.eq(dataTimestamp, 'invalid lastDataTimestamp');
    expect(status.lastBlockId).to.eq(1, 'invalid block ID');
    expect(status.nextBlockId).to.eq(2, 'invalid block ID');
    expect(status.nextLeader).to.eq(validatorAddress, 'invalid validator');
    expect(status.validators).to.eql([validatorAddress], 'invalid validators list');
    expect(status.powers.map((p) => p.toString())).to.eql(['321'], 'invalid powers');
    expect(status.locations).to.eql(['abc'], 'invalid locations');
    expect(status.staked).to.eq(123, 'invalid staked');
  });

  describe('update/replace contract', () => {
    let newChain: Contract;

    beforeEach(async () => {
      await mockSubmit();
      let { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);
      await contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]);

      await mintBlocks(timePadding);

      await mockSubmit();
      ({ r, s, v, dataTimestamp } = await prepareData(validator, dataTimestamp + 1, root));
      await contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]);

      await contractRegistry.mock.getAddress.withArgs(toBytes32('Chain')).returns(contract.address);
      newChain = await contractFactory.deploy(contractRegistry.address, timePadding);
    });

    it('expect to have no blocks', async () => {
      expect(await newChain.blocksCount()).to.eq(0);
    });

    it('expect to have offset', async () => {
      expect(await newChain.blocksCountOffset()).to.eq(2 + 1);
    });

    it('expect to have valid blockId', async () => {
      expect(await contract.getBlockId()).to.eq(2);
      await mintBlocks(timePadding + 1);
      expect(await contract.getBlockId()).to.eq(2);
    });
  });
});
