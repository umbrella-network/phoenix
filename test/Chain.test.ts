import 'hardhat';
import '@nomiclabs/hardhat-ethers';

import hre from 'hardhat';
import { expect, use } from 'chai';
import { ethers, BigNumber, Contract, Wallet, Event } from 'ethers';
import { waffleChai } from '@ethereum-waffle/chai';
import { MockContract } from '@ethereum-waffle/mock-contract';
import { ABI, constants as SDKConstants, LeafKeyCoder, LeafValueCoder } from '@umb-network/toolbox';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { doSnapshot, revertSnapshot, toBytes32 } from '../scripts/utils/helpers';
import { blockTimestamp, increaseTime, mintBlocks } from './utils';
import { ChainStatus } from './types/ChainStatus';
import {
  abiUintEncoder,
  buildTree,
  executeSubmit,
  fetchLogVotersEvents,
  inputs,
  mockSubmit,
  prepareData,
  setupForChainWithMocks,
  sortWallets,
} from './chainUtils';
import { BaseChain } from '../typechain';
import { SubmitPreparedData } from '../types/types';
import SortedMerkleTree from '../lib/SortedMerkleTree';

use(waffleChai);

const { SIGNED_NUMBER_PREFIX } = SDKConstants;

const timePadding = 100;

describe('Chain', () => {
  let owner: SignerWithAddress,
    validator: SignerWithAddress,
    validator2: SignerWithAddress,
    validatorAddress: string,
    stakingBank: MockContract,
    contract: Contract,
    root: string,
    tree: SortedMerkleTree;

  const mockSubmitWrapper = async (leader = validator, totalSupply = 1000, balance = 1000) => {
    await mockSubmit({ stakingBank, leader, totalSupply, balance });
  };

  const executeSubmitWrapper = async (
    dataTimestamp: number,
    validators: SignerWithAddress[] | Wallet[] = [validator],
  ) => {
    await executeSubmit({
      chain: contract,
      validators,
      stakingBank,
      root,
      dataTimestamp,
    });
  };

  let genesisSnapshotId: unknown;

  before(() => {
    tree = buildTree();
    root = tree.getRoot();
  });

  beforeEach(async () => {
    genesisSnapshotId = await doSnapshot(hre);
  });

  afterEach(async () => {
    await revertSnapshot(hre, genesisSnapshotId);
  });

  describe('test signatures', () => {
    let lastDataTimestamp: number;

    beforeEach(async () => {
      ({ owner, validator, validator2, validatorAddress, stakingBank, contract } = await setupForChainWithMocks({
        hre,
        requiredSignatures: 2,
      }));

      lastDataTimestamp = await contract.getLatestBlockId();
    });

    it('throws when not enough participants', async () => {
      await expect(executeSubmitWrapper(lastDataTimestamp + timePadding + 1)).to.revertedWith('NotEnoughSignatures');
    });

    it('throws when signatures not belongs to registered validators', async () => {
      const dataTimestamp = await blockTimestamp();
      const fakeValidators: Wallet[] = [];
      const requiredSignatures = await contract.requiredSignatures();

      for (let i = 0; i < requiredSignatures * 2; i++) {
        const wallet = ethers.Wallet.createRandom();
        fakeValidators.push(wallet);
        await stakingBank.mock.balanceOf.withArgs(wallet.address).returns(0);
      }

      await mockSubmit({ stakingBank, leader: fakeValidators[0], balance: 0 });

      const vv: number[] = [];
      const rr: string[] = [];
      const ss: string[] = [];

      for (const participant of sortWallets(fakeValidators)) {
        const { r, s, v } = await prepareData(participant, dataTimestamp, root);
        vv.push(v);
        rr.push(r);
        ss.push(s);
      }

      await expect(contract.submit(dataTimestamp, root, [], [], vv, rr, ss)).revertedWith('NotEnoughSignatures');
    });

    it('emits LogVoter event only for valid validators', async () => {
      const dataTimestamp = await blockTimestamp();
      const allValidators: Wallet[] = [];
      const requiredSignatures = 2;

      for (let i = 0; i < requiredSignatures * 2; i++) {
        const wallet = ethers.Wallet.createRandom();
        allValidators.push(wallet);
      }

      const sorted = sortWallets(allValidators);

      for (const i in sorted) {
        const validator = sorted[i];
        const balance = parseInt(i, 10) < requiredSignatures ? 0 : i;
        await stakingBank.mock.balanceOf.withArgs(validator.address).returns(balance);
        console.log({ i, balance });
      }

      await mockSubmit({ stakingBank, leader: sorted[0], balance: 0 });

      const vv: number[] = [];
      const rr: string[] = [];
      const ss: string[] = [];

      for (const participant of sorted) {
        const { r, s, v } = await prepareData(participant, dataTimestamp, root);
        vv.push(v);
        rr.push(r);
        ss.push(s);
      }

      const tx = await contract.submit(dataTimestamp, root, [], [], vv, rr, ss);
      const txWithEvents = await tx.wait(1);

      const events = fetchLogVotersEvents(txWithEvents);

      expect(events.length).eq(2);

      events.forEach((e, i) => {
        expect(e.blockId).eq(dataTimestamp);
        expect(e.voter).eq(sorted[requiredSignatures + i].address);
        expect(e.vote).eq(BigInt(requiredSignatures + i));
      });
    });

    it('throws when not enough "good" signatures', async () => {
      const dataTimestamp = await blockTimestamp();
      const allValidators: Wallet[] = [];
      const requiredSignatures = await contract.requiredSignatures();

      for (let i = 0; i < requiredSignatures; i++) {
        const wallet = ethers.Wallet.createRandom();
        allValidators.push(wallet);
        // one of required signatures will be fake
        await stakingBank.mock.balanceOf.withArgs(wallet.address).returns(i);
      }

      await mockSubmit({ stakingBank, leader: allValidators[0], balance: 0 });

      const vv: number[] = [];
      const rr: string[] = [];
      const ss: string[] = [];

      for (const participant of sortWallets(allValidators)) {
        const { r, s, v } = await prepareData(participant, dataTimestamp, root);
        vv.push(v);
        rr.push(r);
        ss.push(s);
      }

      await expect(contract.submit(dataTimestamp, root, [], [], vv, rr, ss)).revertedWith('NotEnoughSignatures');
    });

    it('accept block from 2 participants', async () => {
      // order of validators matters
      await expect(async () => executeSubmitWrapper(await blockTimestamp(), [validator, validator2])).to.throw;
      await expect(async () => executeSubmitWrapper(await blockTimestamp(), [validator2, validator])).to.not.throw;
    });
  });

  describe('Chain', () => {
    beforeEach(async () => {
      ({ owner, validator, validatorAddress, stakingBank, contract } = await setupForChainWithMocks({ hre }));
    });

    describe('when deployed', () => {
      let consensusData: BaseChain.ConsensusDataStruct;

      beforeEach(async () => {
        consensusData = await contract.getConsensusData();
      });

      it('expect to have padding', async () => {
        expect(consensusData.padding).to.eq(timePadding);
      });

      it('expect to have no blocks', async () => {
        expect(consensusData.sequence).to.eq(0);
      });

      it('expect blockId to be initial timestamp', async () => {
        const t = await blockTimestamp();

        expect(await contract.getBlockId())
          .to.gt(0)
          .and.lte(t);
      });

      it('not throw on status', async () => {
        await stakingBank.mock.getNumberOfValidators.returns(0);
        await stakingBank.mock.totalSupply.returns(0);

        await expect(contract.getStatus()).not.to.be.reverted;
      });
    });

    describe('setPadding()', () => {
      it('expect to set block padding', async () => {
        await expect(contract.setPadding(9))
          .to.emit(contract, 'LogPadding')
          .withArgs(await owner.getAddress(), 9);

        const consensusData: BaseChain.ConsensusDataStruct = await contract.getConsensusData();

        expect(consensusData.padding).to.eq(9);
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
      const numberOfValidators = 3;

      it(`expect to return valid index for ${numberOfValidators} validators`, async () => {
        const id = await contract.getLeaderIndex(numberOfValidators, await hre.ethers.provider.getBlockNumber());

        expect(await contract.getLeaderIndex(numberOfValidators, await hre.ethers.provider.getBlockNumber())).to.eq(
          id,
          'round #1',
        );

        await mintBlocks(timePadding + 1);
        console.log(await blockTimestamp());

        expect(await contract.getLeaderIndex(numberOfValidators, await hre.ethers.provider.getBlockNumber())).to.eq(
          (id + 1) % numberOfValidators,
          'round #2',
        );

        await mintBlocks(timePadding + 1);
        console.log(await blockTimestamp());
        expect(await contract.getLeaderIndex(numberOfValidators, await hre.ethers.provider.getBlockNumber())).to.eq(
          (id + 2) % numberOfValidators,
          'round #3',
        );

        await mintBlocks(timePadding + 1);
        console.log(await blockTimestamp());
        expect(await contract.getLeaderIndex(numberOfValidators, await hre.ethers.provider.getBlockNumber())).to.eq(
          (id + 3) % numberOfValidators,
          'round #4',
        );
      });

      describe('when block was minted', () => {
        beforeEach(async () => {
          await executeSubmitWrapper(await blockTimestamp());
        });

        it(`expect to return valid index for ${numberOfValidators}`, async () => {
          const id = await contract.getLeaderIndex(numberOfValidators, await hre.ethers.provider.getBlockNumber());

          expect(await contract.getLeaderIndex(numberOfValidators, await hre.ethers.provider.getBlockNumber())).to.eq(
            id,
            'round #1',
          );

          await mintBlocks(timePadding + 1);
          expect(await contract.getLeaderIndex(numberOfValidators, await hre.ethers.provider.getBlockNumber())).to.eq(
            (id + 1) % numberOfValidators,
            'round #2',
          );

          await mintBlocks(timePadding + 1);
          expect(await contract.getLeaderIndex(numberOfValidators, await hre.ethers.provider.getBlockNumber())).to.eq(
            (id + 2) % numberOfValidators,
            'round #3',
          );

          await mintBlocks(timePadding + 1);
          expect(await contract.getLeaderIndex(numberOfValidators, await hre.ethers.provider.getBlockNumber())).to.eq(
            (id + 3) % numberOfValidators,
            'round #4',
          );
        });
      });
    });

    describe('.submit()', () => {
      describe('without FCD', () => {
        it('expect to mint a block', async () => {
          await mockSubmitWrapper();
          const { r, s, v, dataTimestamp, testimony } = await prepareData(validator, await blockTimestamp(), root);

          console.log({ testimony });
          await expect(contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s])).not.be.reverted;
          console.log(await contract.blocks(dataTimestamp));
        });

        it('fail when signature do not match', async () => {
          await mockSubmitWrapper();
          const { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);

          const differentRoot = '0x0000000000000000000000000000000000000000000000000000000000000001';

          await expect(contract.connect(validator).submit(dataTimestamp, differentRoot, [], [], [v], [r], [s]))
            .to.be // recover sig will return some other address than validator, so mock function will fail
            .revertedWith('Mock on the method is not initialized');
        });

        it('fail when signature arrays do not match', async () => {
          await mockSubmitWrapper();
          const { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);

          await expect(
            contract.connect(validator).submit(dataTimestamp, root, [], [], [], [r], [s]),
          ).to.be.revertedWith('NotEnoughSignatures');

          await expect(
            contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [], [s]),
          ).to.be.revertedWith('out-of-bounds or negative index');

          await expect(
            contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], []),
          ).to.be.revertedWith('out-of-bounds or negative index');

          await expect(contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s])).not.to.be
            .reverted;
        });

        describe('check the future dataTimestamp', () => {
          it('NOT failing when timestamp in acceptable range', async () => {
            await mockSubmitWrapper();
            const t = await blockTimestamp();

            const { r, s, v, dataTimestamp } = await prepareData(validator, t + 4, root);

            await expect(contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s])).not.to.be
              .reverted;
          });

          it.skip('throw when timestamp NOT in acceptable range', async () => {
            // temporary remove this condition, because recently on ropsten we see cases when minter/node
            // can be even 100sec behind

            await mockSubmitWrapper();
            const t = await blockTimestamp();

            const { r, s, v, dataTimestamp } = await prepareData(validator, t + 5, root);

            await expect(
              contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]),
            ).to.be.revertedWith('oh, so you can predict the future:                               4');
          });
        });

        it('generates LogMint event', async () => {
          await mockSubmitWrapper();
          const { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);

          await expect(contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]))
            .to.emit(contract, 'LogMint')
            .withArgs(validatorAddress, dataTimestamp, 1000, 1000);
        });

        it('generates LogVoter event', async () => {
          await mockSubmitWrapper();
          const { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);

          await expect(contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]))
            .to.emit(contract, 'LogVoter')
            .withArgs(dataTimestamp, validatorAddress, 1000);
        });

        describe('when block submitted', () => {
          let previousDataTimestamp: number;
          let dataTimestamp: number;

          beforeEach(async () => {
            await mockSubmitWrapper();

            const { r, s, v, dataTimestamp: t } = await prepareData(validator, await blockTimestamp(), root);

            dataTimestamp = t;
            previousDataTimestamp = t;
            await contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]);
            await mintBlocks(1);
          });

          it('expect blockId to change ONLY when minimal padding reached', async () => {
            while ((await blockTimestamp()) <= previousDataTimestamp + timePadding) {
              expect(await contract.getBlockId()).to.eq(previousDataTimestamp);
              await mintBlocks(1);
            }

            expect(await contract.getBlockId()).to.eq(previousDataTimestamp + timePadding + 1);
          });

          it('expect getBlockIdAtTimestamp return valid ID', async () => {
            expect(await contract.getBlockIdAtTimestamp(previousDataTimestamp)).to.eq(previousDataTimestamp);
            expect(await contract.getBlockIdAtTimestamp(previousDataTimestamp + timePadding)).to.eq(
              previousDataTimestamp,
            );

            const newId = previousDataTimestamp + timePadding + 1;
            expect(await contract.getBlockIdAtTimestamp(newId)).to.eq(newId);
          });

          it('expect to have block timestamp', async () => {
            expect(await contract.getBlockIdAtTimestamp(previousDataTimestamp)).to.eq(previousDataTimestamp);
            expect(await contract.getLatestBlockId()).to.eq(previousDataTimestamp);
          });

          it('expect to have 1 block', async () => {
            const data: BaseChain.ConsensusDataStruct = await contract.getConsensusData();
            expect(data.sequence).to.eq(1);
          });

          it('expect to save valid root', async () => {
            expect((await contract.blocks(dataTimestamp)).root).to.eq(tree.getRoot());
          });

          it('expect to NOT have current FCD', async () => {
            const bytes32 = `0x${abiUintEncoder(0)}`;
            const fcds = await contract.getCurrentValues([bytes32]);
            expect(fcds[0].map((f: BigNumber) => f.toString())).to.eql(['0']);
            expect(fcds[1]).to.eql([0]);
          });

          it('fail when data NOT newer than previous block', async () => {
            await mockSubmitWrapper();
            const { r, s, v, dataTimestamp } = await prepareData(validator, previousDataTimestamp, root);

            await expect(
              contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]),
            ).to.be.revertedWith('BlockSubmittedToFastOrDataToOld');
          });

          describe('verify Proof', () => {
            it('.verifyProofForBlock()', async () => {
              const k = 'BTC-USD';
              const v = inputs[k];
              const proof = tree.getProofForKey(k);

              expect(await contract.verifyProofForBlock(dataTimestamp, proof, LeafKeyCoder.encode(k), v)).to.be.true;
            });
          });

          describe('verifyProofs()', () => {
            it('expect to validate multiple proofs as once', async () => {
              const keys = Object.keys(inputs).slice(-3);
              const blockIds = new Array(keys.length).fill(dataTimestamp);
              const { proofs, proofItemsCounter } = tree.getFlatProofsForKeys(keys);
              const leaves = keys.map((k) => tree.getLeafForKey(k));
              const result = new Array(keys.length).fill(true);

              expect(await contract.verifyProofs(blockIds, proofs, proofItemsCounter, leaves)).to.eql(result);
            });

            it('throws when array length not match', async () => {
              const keys = Object.keys(inputs).slice(-3);
              const blockIds = new Array(keys.length).fill(dataTimestamp);
              const { proofs, proofItemsCounter } = tree.getFlatProofsForKeys(keys);
              const leaves = keys.map((k) => tree.getLeafForKey(k));
              const result = new Array(keys.length).fill(true);

              expect(blockIds.length).gt(1);

              await expect(contract.verifyProofs([blockIds[0]], proofs, proofItemsCounter, leaves)).to.revertedWith(
                'panic code 50',
              );

              await expect(contract.verifyProofs(blockIds, proofs, [proofItemsCounter[0]], leaves)).to.revertedWith(
                'panic code 50',
              );

              const verified = await contract.verifyProofs(blockIds, proofs, proofItemsCounter, [leaves[0]]);
              expect(verified.length).eq(1, 'returned array length is based on leaves');
              expect(verified).to.eql([true]);

              expect(await contract.verifyProofs(blockIds, proofs, proofItemsCounter, leaves)).to.eql(result);
            });
          });

          describe('when still on the same block ID', () => {
            it('expect submit to be reverted', async () => {
              await mockSubmitWrapper();
              const { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);
              await expect(
                contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]),
              ).to.revertedWith('BlockSubmittedToFast');
            });

            describe('when minimal padding reached', () => {
              beforeEach(async () => {
                if (dataTimestamp > (await blockTimestamp())) {
                  await increaseTime(dataTimestamp);
                }

                await contract.setPadding(0);
              });

              it('expect blockId to change', async () => {
                expect(await contract.getBlockId()).to.gt(dataTimestamp);
              });

              describe('when block mined for new blockId', () => {
                let newId: number;

                beforeEach(async () => {
                  await contract.setPadding(1);
                  newId = await blockTimestamp();
                  console.log({ newId });
                  await executeSubmitWrapper(newId);
                  await contract.setPadding(100);
                });

                it('expect to revert when submit again for same block', async () => {
                  await mockSubmitWrapper();
                  const { r, s, v, dataTimestamp } = await prepareData(validator, newId, root);

                  console.log({ dataTimestamp, root });
                  await expect(
                    contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]),
                  ).to.revertedWith('BlockSubmittedToFastOrDataToOld');
                });
              });
            });
          });
        });
      });

      describe('with FCD', () => {
        const signedKey = SIGNED_NUMBER_PREFIX + 'abc';
        const fcdKeys = [toBytes32('a'), toBytes32('b'), '0x' + LeafKeyCoder.encode(signedKey).toString('hex')];
        const fcdValues = [1, 2, '0x' + LeafValueCoder.encode(-321, signedKey).toString('hex')];

        let submittedDataTimestamp: number;

        it('accept max FCD value', async () => {
          await mockSubmitWrapper();
          const values = [1, 2, '0x' + 'F'.repeat(56)];

          const { r, s, v, dataTimestamp } = await prepareData(
            validator,
            await blockTimestamp(),
            root,
            fcdKeys,
            values,
          );

          await expect(contract.submit(dataTimestamp, root, fcdKeys, values, [v], [r], [s])).to.not.be.reverted;
        });

        it.skip('accept max FCD value (GAS calculations)', async () => {
          await mockSubmitWrapper();

          for (let i = 0; i < 20; i++) {
            await mintBlocks(100);
            const { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root, [], []);

            console.log(dataTimestamp);
            await expect(contract.submit(dataTimestamp, root, [], [], [v], [r], [s])).to.not.be.reverted;
            // 1FCD avg = 104497 gas
            // 0 FCD => 87092
          }
        });

        it('throw when key/value array not match', async () => {
          await mockSubmitWrapper();
          const values = [1, 2, '0x' + 'F'.repeat(56)];

          const { r, s, v, dataTimestamp } = await prepareData(
            validator,
            await blockTimestamp(),
            root,
            fcdKeys,
            values,
          );

          // recover sig will return some other address than validator (because we will loop over just one fcd element),
          // so mock function will fail
          await expect(contract.submit(dataTimestamp, root, [fcdKeys[0]], values, [v], [r], [s])).to.be.revertedWith(
            'Mock on the method is not initialized',
          );

          await expect(contract.submit(dataTimestamp, root, fcdKeys, [values[0]], [v], [r], [s])).to.be.revertedWith(
            'out-of-bounds or negative index',
          );

          await expect(contract.submit(dataTimestamp, root, fcdKeys, values, [v], [r], [s])).to.not.be.reverted;
        });

        it('throw when FCD overflows', async () => {
          await mockSubmitWrapper();
          const values = [1, 2, '0x01' + 'F'.repeat(56)];

          const { r, s, v, dataTimestamp } = await prepareData(
            validator,
            await blockTimestamp(),
            root,
            fcdKeys,
            values,
          );

          await expect(contract.submit(dataTimestamp, root, fcdKeys, values, [v], [r], [s])).to.be.reverted;
        });

        describe('when block submitted', () => {
          beforeEach(async () => {
            await mockSubmitWrapper();

            const { r, s, v, dataTimestamp } = await prepareData(
              validator,
              await blockTimestamp(),
              root,
              fcdKeys,
              fcdValues,
            );

            submittedDataTimestamp = dataTimestamp;

            await expect(
              contract.connect(validator).submit(dataTimestamp, root, fcdKeys, fcdValues, [v], [r], [s]),
            ).to.emit(contract, 'LogMint');
          });

          it('expect to have signed integer', async () => {
            const [value, timestamp] = await contract.getCurrentIntValue(fcdKeys[2]);
            console.log({ key: fcdKeys[2], value, timestamp });
            expect(value).to.eq(-321000000000000000000n);
          });

          it('expect to get FCD by key', async () => {
            const [value, time] = await contract.getCurrentValue(fcdKeys[0]);

            expect(value).eq(fcdValues[0]);
            expect(time).eq(submittedDataTimestamp.toFixed(0));
          });

          it('expect to get many FCDs', async () => {
            const fcds = await contract.getCurrentValues(fcdKeys);

            const expected = [[...fcdValues], [submittedDataTimestamp, submittedDataTimestamp, submittedDataTimestamp]];

            fcds[0].forEach((f: BigNumber, n: number) => {
              expect(f).to.eq(expected[0][n]);
              expect(fcds[1][n]).to.eql(expected[1][n]);
            });
          });

          it('expect to validate proof for selected key-value pair', async () => {
            const k = 'BTC-USD';
            const v = inputs[k];
            const proof = tree.getProofForKey(k);

            expect(await contract.verifyProofForBlock(submittedDataTimestamp, proof, LeafKeyCoder.encode(k), v)).to.be
              .true;
          });
        });
      });
    });

    it('expect to getStatus()', async () => {
      await mintBlocks(timePadding);
      await mockSubmitWrapper();
      let { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);
      await contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]);
      console.log(await contract.blocks(dataTimestamp));

      await mintBlocks(timePadding);
      await mockSubmitWrapper();
      ({ r, s, v, dataTimestamp } = await prepareData(validator, dataTimestamp + timePadding + 1, root));
      await contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]);

      await stakingBank.mock.getNumberOfValidators.returns(1);
      await stakingBank.mock.addresses.withArgs(0).returns(validatorAddress);
      await stakingBank.mock.validators.withArgs(validatorAddress).returns(validatorAddress, 'abc');
      await stakingBank.mock.totalSupply.returns(123);
      await stakingBank.mock.balanceOf.withArgs(validatorAddress).returns(321);

      await mintBlocks(timePadding);

      console.log(root);
      console.log(await contract.blocks(dataTimestamp));

      const status: ChainStatus = await contract.getStatus();

      expect(status.lastDataTimestamp).to.eq(dataTimestamp, 'invalid lastDataTimestamp');
      expect(status.lastId).to.eq(dataTimestamp, 'invalid block ID');
      expect(status.nextBlockId).to.eq(dataTimestamp + timePadding + 1, 'invalid next block ID');
      expect(status.nextLeader).to.eq(validatorAddress, 'invalid validator');
      expect(status.validators).to.eql([validatorAddress], 'invalid validators list');
      expect(status.powers.map((p) => p.toString())).to.eql(['321'], 'invalid powers');
      expect(status.locations).to.eql(['abc'], 'invalid locations');
      expect(status.staked).to.eq(123, 'invalid staked');
      expect(status.minSignatures).to.eq(1, 'invalid requiredSignatures');
    });
  });

  describe('test chain events using SDK', () => {
    let sdkContract: Contract;
    let fromBlock: number;
    let toBlock: number;
    let submitData: SubmitPreparedData;

    const toLogMint = (event: Event) => {
      if (!event.args) {
        console.log(event);
        throw Error('invalid event, missing .args');
      }

      return {
        chain: event.address,
        minter: event.args[0],
        blockId: event.args[1].toNumber(),
        staked: event.args[2],
        power: event.args[3],
      };
    };

    const toLogVoter = (event: Event) => {
      if (!event.args) {
        console.log(event);
        throw Error('invalid event, missing .args');
      }

      return {
        blockId: event.args[0].toNumber(),
        voter: event.args[1],
        vote: event.args[2],
      };
    };

    beforeEach(async () => {
      fromBlock = (await hre.ethers.provider.getBlockNumber()) - 1;
      ({ owner, validator, validatorAddress, stakingBank, contract } = await setupForChainWithMocks({ hre }));
      await mockSubmitWrapper();
      submitData = await prepareData(validator, await blockTimestamp(), root);
      const { r, s, v, dataTimestamp } = submitData;
      await contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]);

      sdkContract = new Contract(contract.address, ABI.chainAbi, hre.ethers.provider);
      toBlock = (await hre.ethers.provider.getBlockNumber()) + 1;
    });

    it('expect to fetch LogMint', async () => {
      const filter = sdkContract.filters.LogMint();
      const [event] = await sdkContract.queryFilter(filter, fromBlock, toBlock);
      const logMint = toLogMint(event);
      console.log(toLogMint(event));

      expect(logMint.blockId).eq(submitData.dataTimestamp);
      expect(logMint.minter).eq(validator.address);
      expect(logMint.chain).eq(contract.address);
      expect(logMint.power).eq(1000);
    });

    it('expect to fetch LogVoter', async () => {
      const filter = sdkContract.filters.LogVoter();
      const [event] = await sdkContract.queryFilter(filter, fromBlock, toBlock);
      const logVoter = toLogVoter(event);
      console.log(toLogVoter(event));

      expect(logVoter.blockId).eq(submitData.dataTimestamp);
      expect(logVoter.voter).eq(validator.address);
      expect(logVoter.vote).eq(1000);
    });
  });
});
