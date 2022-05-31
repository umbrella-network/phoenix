import 'hardhat';
import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';
import { expect, use } from 'chai';
import { BigNumber, Contract, ContractFactory, Signer } from 'ethers';
import { waffleChai } from '@ethereum-waffle/chai';
import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { constants as SDKConstants, LeafKeyCoder, LeafValueCoder } from '@umb-network/toolbox';

import Registry from '../../artifacts/contracts/Registry.sol/Registry.json';
import Chain from '../../artifacts/contracts/Chain.sol/Chain.json';
import StakingBank from '../../artifacts/contracts/StakingBank.sol/StakingBank.json';
import Token from '../../artifacts/contracts/mock/Token.sol/Token.json';
import { toBytes32 } from '../../scripts/utils/helpers';
import { blockTimestamp, increaseTime, mintBlocks } from '../utils';
import { ChainStatus } from '../types/ChainStatus';
import { abiUintEncoder, inputs, prepareData, tree } from './chainUtils';

use(waffleChai);

const { SIGNED_NUMBER_PREFIX } = SDKConstants;

const timePadding = 100;

const root = tree.getRoot();

const setup = async (requiredSignatures = 1) => {
  const [owner, validator, validator2] = await ethers.getSigners();
  const token = await deployMockContract(owner, Token.abi);
  const contractRegistry = await deployMockContract(owner, Registry.abi);
  const stakingBank = await deployMockContract(owner, StakingBank.abi);
  const contractFactory = new ContractFactory(Chain.abi, Chain.bytecode, owner);

  await contractRegistry.mock.getAddress.withArgs(toBytes32('Chain')).returns(ethers.constants.AddressZero);
  await contractRegistry.mock.requireAndGetAddress.withArgs(toBytes32('StakingBank')).returns(stakingBank.address);

  const contract = await contractFactory.deploy(contractRegistry.address, timePadding, requiredSignatures);

  return {
    owner,
    validator,
    validator2,
    validatorAddress: await validator.getAddress(),
    token,
    contractRegistry,
    stakingBank,
    contract,
    contractFactory,
  };
};

describe('Chain', () => {
  let owner: Signer,
    validator: Signer,
    validator2: Signer,
    validatorAddress: string,
    contractRegistry: Contract,
    stakingBank: Contract,
    contract: Contract,
    contractFactory: ContractFactory;

  const mockSubmit = async (leader = validator, totalSupply = 1000, balance = 1000) => {
    await stakingBank.mock.totalSupply.returns(totalSupply);
    await stakingBank.mock.balanceOf.withArgs(await leader.getAddress()).returns(balance);
  };

  const executeSubmit = async (blockId: number, dataTimestamp: number, validators = [validator]): Promise<unknown> => {
    await mockSubmit();

    if (validators.length > 1) {
      await stakingBank.mock.balanceOf.withArgs(await validator2.getAddress()).returns(1000);
    }

    const vv: number[] = [];
    const rr: string[] = [];
    const ss: string[] = [];

    for (const participant of validators) {
      const { r, s, v } = await prepareData(participant, dataTimestamp, root);
      vv.push(v);
      rr.push(r);
      ss.push(s);
    }

    return contract.connect(validator).submit(dataTimestamp, root, [], [], vv, rr, ss);
  };

  describe('test signatures', () => {
    beforeEach(async () => {
      ({
        owner,
        validator,
        validator2,
        validatorAddress,
        contractRegistry,
        stakingBank,
        contract,
        contractFactory,
      } = await setup(2));
    });

    it('throws when not enough participants', async () => {
      await expect(executeSubmit(0, await blockTimestamp())).to.revertedWith('NotEnoughSignatures');
    });

    it('accept block from 2 participants', async () => {
      // order of validators matters
      await expect(async () => executeSubmit(0, await blockTimestamp(), [validator2, validator])).to.not.throw;
    });
  });

  describe('Chain', () => {
    beforeEach(async () => {
      ({
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
      const numberOfValidators = 3;

      it(`expect to return valid index for ${numberOfValidators}`, async () => {
        const id = await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber());

        expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
          id,
          'round #1'
        );

        await mintBlocks(timePadding);
        console.log(await blockTimestamp());
        expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
          (id + 1) % numberOfValidators,
          'round #2'
        );

        await mintBlocks(timePadding);
        console.log(await blockTimestamp());
        expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
          (id + 2) % numberOfValidators,
          'round #3'
        );

        await mintBlocks(timePadding);
        console.log(await blockTimestamp());
        expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
          (id + 3) % numberOfValidators,
          'round #4'
        );
      });

      describe('when block was minted', () => {
        beforeEach(async () => {
          const t = await blockTimestamp();
          await increaseTime(t % timePadding);
          await executeSubmit(0, await blockTimestamp());
        });

        it(`expect to return valid index for ${numberOfValidators}`, async () => {
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

    describe('.submit()', () => {
      describe('without FCD', () => {
        it('expect to mint a block', async () => {
          await mockSubmit();
          const { r, s, v, dataTimestamp, testimony } = await prepareData(validator, await blockTimestamp(), root);

          console.log({ testimony });
          await expect(contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s])).not.be.reverted;
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

          it.skip('throw when timestamp NOT in acceptable range', async () => {
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
          let dataTimestamp: number;

          beforeEach(async () => {
            await mockSubmit();
            const { r, s, v, dataTimestamp: t } = await prepareData(validator, await blockTimestamp(), root);
            dataTimestamp = t;
            previousDataTimestamp = t;
            await contract.connect(validator).submit(t, root, [], [], [v], [r], [s]);
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
            expect((await contract.blocks(0)).root).to.eq(tree.getRootSquashed(dataTimestamp));
          });

          it('expect to NOT have current FCD', async () => {
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
            ).to.be.revertedWith('DataToOld');
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
              ).to.revertedWith('BlockSubmittedToFast');
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
                  ).to.revertedWith('BlockSubmittedToFast');
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
          await mockSubmit();
          const values = [1, 2, '0x' + 'F'.repeat(56)];

          const { r, s, v, dataTimestamp } = await prepareData(
            validator,
            await blockTimestamp(),
            root,
            fcdKeys,
            values
          );

          await expect(contract.submit(dataTimestamp, root, fcdKeys, values, [v], [r], [s])).to.not.be.reverted;
        });

        it.skip('accept max FCD value GAS', async () => {
          await mockSubmit();

          for (let i = 0; i < 20; i++) {
            await mintBlocks(100);
            const { r, s, v, dataTimestamp } = await prepareData(validator, await blockTimestamp(), root, [], []);

            console.log(dataTimestamp);
            await expect(contract.submit(dataTimestamp, root, [], [], [v], [r], [s])).to.not.be.reverted;
            // 1FCD avg = 104497 gas
            // 0 FCD => 87092
          }
        });

        it('throw when FCD overflows', async () => {
          await mockSubmit();
          const values = [1, 2, '0x01' + 'F'.repeat(56)];

          const { r, s, v, dataTimestamp } = await prepareData(
            validator,
            await blockTimestamp(),
            root,
            fcdKeys,
            values
          );

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

      await stakingBank.mock.getNumberOfValidators.returns(1);
      await stakingBank.mock.addresses.withArgs(0).returns(validatorAddress);
      await stakingBank.mock.validators.withArgs(validatorAddress).returns(validatorAddress, 'abc');
      await stakingBank.mock.totalSupply.returns(123);
      await stakingBank.mock.balanceOf.withArgs(validatorAddress).returns(321);

      await mintBlocks(timePadding);

      console.log(root);
      console.log(await contract.blocks(0));
      console.log(await contract.blocks(1));

      const status: ChainStatus = await contract.getStatus();

      expect(status.lastDataTimestamp).to.eq(dataTimestamp, 'invalid lastDataTimestamp');
      expect(status.lastBlockId).to.eq(1, 'invalid block ID');
      expect(status.nextBlockId).to.eq(2, 'invalid next block ID');
      expect(status.nextLeader).to.eq(validatorAddress, 'invalid validator');
      expect(status.validators).to.eql([validatorAddress], 'invalid validators list');
      expect(status.powers.map((p) => p.toString())).to.eql(['321'], 'invalid powers');
      expect(status.locations).to.eql(['abc'], 'invalid locations');
      expect(status.staked).to.eq(123, 'invalid staked');
      expect(status.minSignatures).to.eq(1, 'invalid requiredSignatures');
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
        newChain = await contractFactory.deploy(contractRegistry.address, timePadding, 1);
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
});
