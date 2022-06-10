import 'hardhat';
import '@nomiclabs/hardhat-ethers';

import { artifacts, ethers } from 'hardhat';
import { expect, use } from 'chai';
import { BigNumber, Contract, ContractFactory, Signer } from 'ethers';
import { waffleChai } from '@ethereum-waffle/chai';
import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { LeafKeyCoder } from '@umb-network/toolbox';

import { toBytes32 } from '../../scripts/utils/helpers';
import { blockTimestamp, mintBlocks } from '../utils';
import { ForeignChainStatus } from '../types/ChainStatus';
import { abiUintEncoder, inputs, prepareData, tree } from './chainUtils';

use(waffleChai);

const Registry = artifacts.readArtifactSync('Registry');
const ForeignChain = artifacts.readArtifactSync('ForeignChain');

const timePadding = 100;

const root = tree.getRoot();

const setup = async (requiredSignatures = 1) => {
  const [owner, replicator, validator] = await ethers.getSigners();
  const contractRegistry = await deployMockContract(owner, Registry.abi);
  const contractFactory = new ContractFactory(ForeignChain.abi, ForeignChain.bytecode, owner);

  await contractRegistry.mock.getAddress.withArgs(toBytes32('Chain')).returns(ethers.constants.AddressZero);

  const contract = await contractFactory.deploy(
    contractRegistry.address,
    timePadding,
    requiredSignatures,
    replicator.address
  );

  return {
    owner,
    replicator,
    validator,
    replicatorAddress: await replicator.getAddress(),
    contractRegistry,
    contract,
  };
};

describe('ForeignChain', () => {
  let owner: Signer, validator: Signer, replicator: Signer, replicatorAddress: string, contract: Contract;

  const executeSubmit = async (
    dataTimestamp: number,
    treeRoot = root,
    fcdKeys: string[] = [],
    values: (number | string)[] = [],
    blockId = 0
  ) => {
    await contract.connect(replicator).submit(dataTimestamp, treeRoot, fcdKeys, values, blockId);
  };

  describe('tests', () => {
    beforeEach(async () => {
      return ({ owner, validator, replicator, contract, replicatorAddress } = await setup());
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

      it('expect to lastBlockId to be 0', async () => {
        expect(await contract.lastBlockId()).to.eq(0);
      });

      it('not throw on status', async () => {
        await expect(contract.getStatus()).not.to.be.reverted;
      });
    });

    describe('.submit()', () => {
      describe('without FCD', () => {
        it('expect to mint a block', async () => {
          const { dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);
          await expect(executeSubmit(dataTimestamp)).not.be.reverted;
        });

        it('fail when not replicator (validator)', async () => {
          const { dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);

          await expect(contract.connect(validator).submit(dataTimestamp, root, [], [], 0)).to.be.revertedWith(
            'OnlyReplicator'
          );
        });

        it('fail when not replicator (owner)', async () => {
          const { dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);

          await expect(contract.connect(owner).submit(dataTimestamp, root, [], [], 0)).to.be.revertedWith(
            'OnlyReplicator'
          );
        });

        describe('check the future dataTimestamp', () => {
          it('NOT failing when timestamp in acceptable range', async () => {
            const t = await blockTimestamp();
            const { dataTimestamp } = await prepareData(validator, t + 4, root);

            await expect(executeSubmit(dataTimestamp)).not.to.be.reverted;
          });

          it.skip('throw when timestamp NOT in acceptable range', async () => {
            // temporary remove this condition, because recently on ropsten we see cases when minter/node
            // can be even 100sec behind

            const t = await blockTimestamp();

            const { dataTimestamp } = await prepareData(validator, t + 5, root);

            const reason = 'oh, so you can predict the future:                               4';
            await expect(executeSubmit(dataTimestamp)).to.be.revertedWith(reason);
          });
        });

        it('generates LogBlockReplication event', async () => {
          const { dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);

          await expect(contract.connect(replicator).submit(dataTimestamp, root, [], [], 1))
            .to.emit(contract, 'LogBlockReplication')
            .withArgs(replicatorAddress, 1);
        });

        describe('when block submitted', () => {
          let previousDataTimestamp: number;

          beforeEach(async () => {
            const { dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);
            previousDataTimestamp = dataTimestamp;
            await executeSubmit(dataTimestamp);
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

            expect(lastDataTimestamp).to.gt(0);
            expect(await contract.getBlockIdAtTimestamp(lastDataTimestamp)).to.eq(0);
            expect(await contract.getBlockIdAtTimestamp(lastDataTimestamp + timePadding)).to.eq(0);
            expect(await contract.getBlockIdAtTimestamp(lastDataTimestamp + timePadding + 1)).to.eq(1);
          });

          it('expect to save last block Id', async () => {
            expect(await contract.lastBlockId()).to.eq(0);
          });

          it('expect to save valid root', async () => {
            expect((await contract.blocks(0)).root.slice(0, 58)).to.eq(tree.getRoot().slice(0, 58));
          });

          it('expect to have no current FCD', async () => {
            const bytes32 = `0x${abiUintEncoder(0)}`;
            const fcds = await contract.getCurrentValues([bytes32]);
            expect(fcds[0].map((f: BigNumber) => f.toString())).to.eql(['0']);
            expect(fcds[1]).to.eql([0]);
          });

          it('fail when data NOT newer than previous block', async () => {
            await mintBlocks(timePadding);
            const { dataTimestamp } = await prepareData(validator, previousDataTimestamp, root);

            await expect(executeSubmit(dataTimestamp, root, [], [], 1)).to.be.revertedWith('DataToOld');
          });

          it('fail when submit the same blockId', async () => {
            await mintBlocks(timePadding);
            const { dataTimestamp } = await prepareData(validator, previousDataTimestamp, root);

            await expect(executeSubmit(dataTimestamp, root, [], [], 0)).to.be.revertedWith('DuplicatedBlockId');
          });

          it('can submit with gaps', async () => {
            await mintBlocks(timePadding);
            const { dataTimestamp } = await prepareData(validator, previousDataTimestamp, root);

            await expect(contract.connect(replicator).submit(dataTimestamp + 1, root, [], [], 999)).not.be.reverted;
            expect(await contract.lastBlockId()).to.eq(999);
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
              const { dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);
              await expect(executeSubmit(dataTimestamp, root, [], [], 1)).to.revertedWith('BlockSubmittedToFast');
            });

            describe('when minimal padding reached', () => {
              beforeEach(async () => {
                await contract.setPadding(0);
              });

              it('expect blockId to change', async () => {
                expect(await contract.getBlockId()).to.eq(1);
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
          const values = [1, '0x' + 'F'.repeat(56)];

          const { dataTimestamp } = await prepareData(validator, await blockTimestamp(), root, fcdKeys, values);

          await expect(executeSubmit(dataTimestamp, root, fcdKeys, values, 1)).to.not.be.reverted;
        });

        it('throw when FCD overflows', async () => {
          const values = [1, '0x01' + 'F'.repeat(56)];

          const { dataTimestamp } = await prepareData(validator, await blockTimestamp(), root, fcdKeys, values);

          await expect(executeSubmit(dataTimestamp, root, fcdKeys, values, 1)).to.be.reverted;
        });

        describe('when block submitted', () => {
          beforeEach(async () => {
            const { dataTimestamp } = await prepareData(validator, await blockTimestamp(), root, fcdKeys, fcdValues);
            submittedDataTimestamp = dataTimestamp;

            await expect(contract.connect(replicator).submit(dataTimestamp, root, fcdKeys, fcdValues, 2))
              .to.emit(contract, 'LogBlockReplication')
              .withArgs(replicatorAddress, 2);
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

            expect(await contract.verifyProofForBlock(0, proof, LeafKeyCoder.encode(k), v)).to.be.false;
            expect(await contract.verifyProofForBlock(2, proof, LeafKeyCoder.encode(k), v)).to.be.true;
          });
        });
      });
    });

    it('expect to getStatus()', async () => {
      await mintBlocks(timePadding);
      let { dataTimestamp } = await prepareData(validator, await blockTimestamp(), root);
      await executeSubmit(dataTimestamp, root, [], [], 1);

      await mintBlocks(timePadding);
      ({ dataTimestamp } = await prepareData(validator, dataTimestamp + 1, root));
      await executeSubmit(dataTimestamp, root, [], [], 22);

      await mintBlocks(timePadding);

      const status: ForeignChainStatus = await contract.getStatus();

      expect(status.lastDataTimestamp).to.eq(dataTimestamp, 'invalid lastDataTimestamp');
      expect(status.lastId).to.eq(22, 'invalid block ID');
      expect(status.nextBlockId).to.eq(23, 'invalid next block ID');
    });
  });
});
