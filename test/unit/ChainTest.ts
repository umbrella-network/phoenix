import hre, { ethers } from 'hardhat';
import { expect, use } from 'chai';
import { BigNumber, Contract, ContractFactory, Signer } from 'ethers';
import { waffleChai } from '@ethereum-waffle/chai';
import { deployMockContract } from '@ethereum-waffle/mock-contract';

import { LeafKeyCoder, LeafType, LeafValueCoder } from '@umb-network/toolbox';

import SortedMerkleTree from '../../lib/SortedMerkleTree';

import Registry from '../../artifacts/contracts/Registry.sol/Registry.json';
import Chain from '../../artifacts/contracts/Chain.sol/Chain.json';
import ValidatorRegistry from '../../artifacts/contracts/ValidatorRegistry.sol/ValidatorRegistry.json';
import StakingBank from '../../artifacts/contracts/StakingBank.sol/StakingBank.json';
import Token from '../../artifacts/contracts/Token.sol/Token.json';
import { toBytes32 } from '../../scripts/utils/helpers';
import { blockTimestamp, mintBlocks } from '../utils';

const { toWei } = hre.web3.utils;

use(waffleChai);

export interface ChainStatus {
  blockNumber: BigNumber;
  lastDataTimestamp: BigNumber;
  lastBlockHeight: BigNumber;
  nextBlockHeight: BigNumber;
  nextLeader: string;
  validators: string[];
  powers: BigNumber[];
  locations: string[];
  staked: BigNumber;
}

const blockPadding = 100;

const setup = async () => {
  const [owner, validator] = await ethers.getSigners();
  const token = await deployMockContract(owner, Token.abi);
  const contractRegistry = await deployMockContract(owner, Registry.abi);
  const validatorRegistry = await deployMockContract(owner, ValidatorRegistry.abi);
  const stakingBank = await deployMockContract(owner, StakingBank.abi);
  const contractFactory = new ContractFactory(Chain.abi, Chain.bytecode, owner);

  await contractRegistry.mock.getAddress.withArgs(toBytes32('Chain')).returns(ethers.constants.AddressZero);

  const contract = await contractFactory.deploy(contractRegistry.address, blockPadding);

  return {
    owner,
    validator,
    validatorAddress: await validator.getAddress(),
    token,
    contractRegistry,
    validatorRegistry,
    stakingBank,
    contract,
    contractFactory,
  };
};

const inputs: Record<string, Buffer> = {};

const keys = [
  'eth-eur',
  'btc-eur',
  'war-eur',
  'ltc-eur',
  'uni-eur',
  'eth-usd',
  'btc-usd',
  'war-usd',
  'ltc-usd',
  'uni-usd',
];

keys.forEach((k, i) => {
  inputs[k] = LeafValueCoder.encode(i + 1, LeafType.TYPE_INTEGER);
});

const tree = new SortedMerkleTree(inputs);
const root = tree.getHexRoot();

const prepareData = async (
  signer: Signer,
  blockHeight: number,
  dataTimestamp: number,
  root: string | null,
  fcdKeys: string[] = [],
  fcdValues: number[] = []
) => {
  let testimony = ethers.utils.defaultAbiCoder.encode(
    ['uint256', 'uint256', 'bytes32'],
    [blockHeight, dataTimestamp, root]
  );

  for (let i = 0; i < fcdKeys.length; i++) {
    testimony += ethers.utils.defaultAbiCoder.encode(['bytes32', 'uint256'], [fcdKeys[i], fcdValues[i]]).slice(2);
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
    validatorRegistry: Contract,
    stakingBank: Contract,
    contract: Contract,
    contractFactory: ContractFactory;

  const mockSubmit = async (leader = validator, totalSupply = 1000, balance = 1000) => {
    await contractRegistry.mock.requireAndGetAddress
      .withArgs(toBytes32('ValidatorRegistry'))
      .returns(validatorRegistry.address);

    await contractRegistry.mock.requireAndGetAddress.withArgs(toBytes32('StakingBank')).returns(stakingBank.address);
    await stakingBank.mock.totalSupply.returns(totalSupply);
    await stakingBank.mock.balanceOf.withArgs(await leader.getAddress()).returns(balance);
  };

  const executeSubmit = async (blockHeight: number, dataTimestamp: number) => {
    await mockSubmit();
    const { r, s, v } = await prepareData(validator, blockHeight, dataTimestamp, root);
    await contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]);
  };

  beforeEach(async () => {
    return ({
      owner,
      validator,
      validatorAddress,
      contractRegistry,
      validatorRegistry,
      stakingBank,
      contract,
      contractFactory,
    } = await setup());
  });

  describe('when deployed', () => {
    it('expect to have blockPadding', async () => {
      expect(await contract.blockPadding()).to.eq(blockPadding);
    });

    it('expect to have no blocks', async () => {
      expect(await contract.blocksCount()).to.eq(0);
    });

    it('expect to blockHeight to be 0', async () => {
      expect(await contract.getBlockHeight()).to.eq(0);
    });

    it('not throw on status', async () => {
      await contractRegistry.mock.requireAndGetAddress
        .withArgs(toBytes32('ValidatorRegistry'))
        .returns(validatorRegistry.address);

      await validatorRegistry.mock.getNumberOfValidators.returns(0);
      await contractRegistry.mock.requireAndGetAddress.withArgs(toBytes32('StakingBank')).returns(stakingBank.address);
      await stakingBank.mock.totalSupply.returns(0);

      await expect(contract.getStatus()).not.to.be.reverted;
    });
  });

  describe('setBlockPadding()', () => {
    it('expect to set block padding', async () => {
      await expect(contract.setBlockPadding(9))
        .to.emit(contract, 'LogBlockPadding')
        .withArgs(await owner.getAddress(), 9);

      expect(await contract.blockPadding()).to.eq(9);
    });

    it('expect to throw when call from NOT an owner', async () => {
      await expect(contract.connect(validator).setBlockPadding(9)).to.revertedWith(
        'revert Ownable: caller is not the owner'
      );
    });
  });

  describe('recoverSigner()', () => {
    it('expect to return signer', async () => {
      const { sig, affidavit, r, s, v, hashForSolidity } = await prepareData(validator, 0, 1, root);

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

  describe('.decodeLeafToNumber()', () => {
    [
      '0',
      '1',
      '2',
      '999',
      Number.MAX_SAFE_INTEGER.toString(10),
      // @todo not supported yet max uint256
      // '115792089237316195423570985008687907853269984665640564039457584007913129639935',
      // '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
    ].forEach((data) => {
      it(`expect ${data} to be decoded properly to number`, async () => {
        const bytes = LeafValueCoder.encode(data, LeafType.TYPE_INTEGER);
        const result = await contract.decodeLeafToNumber(bytes);
        expect(result).to.eq(data);
      });
    });

    describe('throws when', () => {
      it('bytes are empty', async () => {
        await expect(contract.decodeLeafToNumber('0x00')).to.revertedWith(
          'revert invalid leaf bytes - missing type metadata'
        );
      });

      it('missing metadata type marker', async () => {
        await expect(contract.decodeLeafToNumber('0x1111111111')).to.revertedWith(
          'revert invalid leaf - missing type marker'
        );
      });

      it('invalid type', async () => {
        const bytes = LeafValueCoder.encode('1', LeafType.TYPE_FLOAT);

        await expect(contract.decodeLeafToNumber(bytes)).to.revertedWith(
          'revert invalid leaf - invalid type - expect 02:int'
        );
      });
    });
  });

  describe('.decodeLeafToFloat()', () => {
    Object.entries({
      '0': '0',
      '1': toWei('1', 'ether'),
      '0.1': `1${'0'.repeat(17)}`,
      '0.123456789': `123456789${'0'.repeat(9)}`,
      '0.000000000000001': `1${'0'.repeat(3)}`,
      '999': toWei('999', 'ether'),
      '0.900719925474099': '900719925474099000',
    }).forEach((data) => {
      it(`expect ${data[0]} to be decoded correctly to float: ${data[1]}`, async () => {
        const bytes = LeafValueCoder.encode(data[0], LeafType.TYPE_FLOAT);
        const result = await contract.decodeLeafToFloat(bytes);
        expect(result.toString()).to.eq(data[1]);
      });
    });

    describe('throws when', () => {
      it('bytes are empty', async () => {
        await expect(contract.decodeLeafToFloat('0x00')).to.revertedWith(
          'revert invalid leaf bytes - missing type metadata'
        );
      });

      it('missing metadata type marker', async () => {
        await expect(contract.decodeLeafToFloat('0x1111111111')).to.revertedWith(
          'revert invalid leaf - missing type marker'
        );
      });

      it('invalid type', async () => {
        const bytes = LeafValueCoder.encode('1', LeafType.TYPE_INTEGER);

        await expect(contract.decodeLeafToFloat(bytes)).to.revertedWith(
          'revert invalid leaf - invalid type - expect 03:float'
        );
      });
    });
  });

  describe('.getLeaderIndex()', () => {
    const { getBlockNumber } = ethers.provider;

    [1, 2, 3, 4].forEach((numberOfValidators) => {
      it(`expect to return valid index for ${numberOfValidators}`, async () => {
        const id = (await contract.getLeaderIndex(numberOfValidators, await getBlockNumber())).toNumber();
        let bn = await getBlockNumber();

        expect(await contract.getLeaderIndex(numberOfValidators, bn)).to.eq(id, 'round #1');

        await mintBlocks(blockPadding + 1);
        bn = await getBlockNumber();
        expect(await contract.getLeaderIndex(numberOfValidators, bn)).to.eq((id + 1) % numberOfValidators, 'round #2');

        await mintBlocks(blockPadding + 1);
        bn = await getBlockNumber();
        expect(await contract.getLeaderIndex(numberOfValidators, bn)).to.eq((id + 2) % numberOfValidators, 'round #3');

        await mintBlocks(blockPadding + 1);
        bn = await getBlockNumber();
        expect(await contract.getLeaderIndex(numberOfValidators, bn)).to.eq((id + 3) % numberOfValidators, 'round #4');
      });
    });

    describe('when block was minted', () => {
      beforeEach(async () => {
        await executeSubmit(0, await blockTimestamp());
      });

      [1, 2, 3, 4].forEach((numberOfValidators) => {
        it(`expect to return valid index for ${numberOfValidators}`, async () => {
          let bn = await getBlockNumber();
          const id = (await contract.getLeaderIndex(numberOfValidators, bn)).toNumber();
          expect(await contract.getLeaderIndex(numberOfValidators, bn)).to.eq(id, 'round #1');

          await mintBlocks(blockPadding + 1);
          bn = await getBlockNumber();
          expect(await contract.getLeaderIndex(numberOfValidators, bn)).to.eq(
            (id + 1) % numberOfValidators,
            'round #2'
          );

          await mintBlocks(blockPadding + 1);
          bn = await getBlockNumber();
          expect(await contract.getLeaderIndex(numberOfValidators, bn)).to.eq(
            (id + 2) % numberOfValidators,
            'round #3'
          );

          await mintBlocks(blockPadding + 1);
          bn = await getBlockNumber();
          expect(await contract.getLeaderIndex(numberOfValidators, bn)).to.eq(
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
        const { r, s, v, dataTimestamp } = await prepareData(validator, 0, await blockTimestamp(), root);

        await expect(contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s])).not.to.be.reverted;
        console.log(await contract.blocks(0));
      });

      it('fail when signature do not match', async () => {
        await mockSubmit();
        const { r, s, v, dataTimestamp } = await prepareData(validator, 0, await blockTimestamp(), root);

        const differentRoot = '0x0000000000000000000000000000000000000000000000000000000000000001';
        await expect(contract.connect(validator).submit(dataTimestamp, differentRoot, [], [], [v], [r], [s]))
          .to.be // recover sig will return some other address than validator, so mock function will fail
          .revertedWith('Mock on the method is not initialized');
      });

      /* it('fail when data older than 25 minutes', async () => {
        await mockSubmit();
        const t = await blockTimestamp();
        const { r, s, v, dataTimestamp } = await prepareData(validator, 0, t - 25 * 60 - 1, root);

        await expect(contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s])).to.be.revertedWith(
          'data are older than 25 minutes'
        );
      });

      it('fail when data from future', async () => {
        await mockSubmit();
        const t = await blockTimestamp();
        const { r, s, v, dataTimestamp } = await prepareData(validator, 0, t + 65, root);

        await expect(contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s])).to.be.revertedWith(
          'oh, so you can predict future'
        );
      }); // */

      describe('when block submitted', () => {
        let previousDataTimestamp: number;

        beforeEach(async () => {
          await mockSubmit();
          const { r, s, v, dataTimestamp } = await prepareData(validator, 0, await blockTimestamp(), root);
          previousDataTimestamp = dataTimestamp;
          await contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]);
        });

        it('expect to blockHeight NOT change when minimal padding not reached', async () => {
          expect(await contract.getBlockHeight()).to.eq(0);
        });

        it('expect to have 1 block', async () => {
          expect(await contract.blocksCount()).to.eq(1);
        });

        it('expect to save valid root', async () => {
          expect((await contract.blocks(0)).root).to.eq(tree.getHexRoot());
        });

        it('expect to get number of block voters', async () => {
          expect(await contract.getBlockVotersCount(0)).to.eq(1);
        });

        it('expect to get block voters', async () => {
          const voter = await validator.getAddress();
          expect(await contract.getBlockVoters(0)).to.eql([voter]);
        });

        it('expect to get block votes', async () => {
          const voter = await validator.getAddress();
          expect(await contract.getBlockVotes(0, voter)).to.eq(1000);
        });

        it('expect to get current FCD', async () => {
          const bytes32 = `0x${'0'.repeat(64)}`;
          const fcds = await contract.getCurrentValues([bytes32]);
          expect(fcds[0]).to.eql([BigNumber.from(0)]);
          expect(fcds[1]).to.eql([BigNumber.from(0)]);
        });

        it('fail when data NOT newer than previous block', async () => {
          await mintBlocks(blockPadding);
          await mockSubmit();
          const { r, s, v, dataTimestamp } = await prepareData(validator, 1, previousDataTimestamp, root);

          await expect(
            contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s])
          ).to.be.revertedWith('can NOT submit older data');
        });

        describe('verify Proof', () => {
          describe('.verifyProofForBlock()', () => {
            it('expect to validate proof for selected key-value pair', async () => {
              const k = 'btc-usd';
              const v = inputs[k];
              const proof = tree.getProofForKey(k);

              expect(await contract.verifyProofForBlock(0, proof, LeafKeyCoder.encode(k), v)).to.be.true;
            });
          });
        });

        describe('verifyProofForBlockForNumber()', () => {
          it('expect to validate proof for selected key-value pair for decoded number value', async () => {
            const k = 'btc-usd';
            const v = inputs[k];

            const proof = tree.getProofForKey(k);
            const result = await contract.verifyProofForBlockForNumber(0, proof, LeafKeyCoder.encode(k), v);

            expect(result[0]).to.eq(true);
            expect(result[1]).to.eq(LeafValueCoder.decode(inputs[k].toString('hex')));
          });
        });

        describe('verifyProofs()', () => {
          it('expect to validate multiple proofs as once', async () => {
            const keys = Object.keys(inputs).slice(-3);
            const blockHeights = new Array(keys.length).fill(0);
            const { proofs, proofItemsCounter } = tree.getFlatProofsForKeys(keys);
            const leaves = keys.map((k) => tree.getLeafForKey(k));
            const result = new Array(keys.length).fill(true);

            expect(await contract.verifyProofs(blockHeights, proofs, proofItemsCounter, leaves)).to.eql(result);
          });
        });

        describe('when still on the same block height', () => {
          it('expect submit to be reverted', async () => {
            await mockSubmit();
            const { r, s, v, dataTimestamp } = await prepareData(validator, 0, await blockTimestamp(), root);
            await expect(
              contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s])
            ).to.revertedWith('revert block already mined for current blockHeight');
          });

          describe('when minimal padding reached', () => {
            beforeEach(async () => {
              await contract.setBlockPadding(0);
            });

            it('expect to blockHeight to change', async () => {
              expect(await contract.getBlockHeight()).to.eq(1);
            });

            describe('when block mined for new block height', () => {
              beforeEach(async () => {
                await contract.setBlockPadding(1);
                await executeSubmit(1, await blockTimestamp());
                await contract.setBlockPadding(100);
              });

              it('expect to revert when submit again for same block', async () => {
                await mockSubmit();
                const { r, s, v, dataTimestamp } = await prepareData(validator, 1, await blockTimestamp(), root);
                await expect(
                  contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s])
                ).to.revertedWith('revert block already mined for current blockHeight');
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

      describe('when block submitted', () => {
        beforeEach(async () => {
          await mockSubmit();
          const { r, s, v, dataTimestamp } = await prepareData(
            validator,
            0,
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
          expect(fcd).to.eql([BigNumber.from(fcdValues[0]), BigNumber.from(submittedDataTimestamp)]);
        });

        it('expect to get many FCDs', async () => {
          const fcds = await contract.getCurrentValues(fcdKeys);

          const expected = [
            [BigNumber.from(fcdValues[0]), BigNumber.from(fcdValues[1])],
            [BigNumber.from(submittedDataTimestamp), BigNumber.from(submittedDataTimestamp)],
          ];

          expect(fcds).to.eql(expected);
        });

        it('expect to validate proof for selected key-value pair', async () => {
          const k = 'btc-usd';
          const v = inputs[k];
          const proof = tree.getProofForKey(k);

          expect(await contract.verifyProofForBlock(0, proof, LeafKeyCoder.encode(k), v)).to.be.true;
        });
      });
    });
  });

  it('expect to getStatus()', async () => {
    await mintBlocks(blockPadding);
    await mockSubmit();
    let { r, s, v, dataTimestamp } = await prepareData(validator, 0, await blockTimestamp(), root);
    await contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]);

    await mintBlocks(blockPadding);
    await mockSubmit();
    ({ r, s, v, dataTimestamp } = await prepareData(validator, 1, dataTimestamp + 1, root));
    await contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]);

    await contractRegistry.mock.requireAndGetAddress
      .withArgs(toBytes32('ValidatorRegistry'))
      .returns(validatorRegistry.address);
    await validatorRegistry.mock.getNumberOfValidators.returns(1);
    await validatorRegistry.mock.addresses.withArgs(0).returns(validatorAddress);
    await validatorRegistry.mock.validators.withArgs(validatorAddress).returns(validatorAddress, 'abc');
    await contractRegistry.mock.requireAndGetAddress.withArgs(toBytes32('StakingBank')).returns(stakingBank.address);
    await stakingBank.mock.totalSupply.returns(123);
    await stakingBank.mock.balanceOf.withArgs(validatorAddress).returns(321);

    await mintBlocks(blockPadding);

    const status: ChainStatus = await contract.getStatus();

    expect(status.lastDataTimestamp).to.eq(dataTimestamp, 'invalid lastDataTimestamp');
    expect(status.lastBlockHeight).to.eq(1, 'invalid block height');
    expect(status.nextBlockHeight).to.eq(2, 'invalid block height');
    expect(status.nextLeader).to.eq(validatorAddress, 'invalid validator');
    expect(status.validators).to.eql([validatorAddress], 'invalid validators list');
    expect(status.powers).to.eql([BigNumber.from(321)], 'invalid powers');
    expect(status.locations).to.eql(['abc'], 'invalid locations');
    expect(status.staked).to.eq(123, 'invalid staked');
  });

  describe('update/replace contract', () => {
    let newChain: Contract;

    beforeEach(async () => {
      await mockSubmit();
      let { r, s, v, dataTimestamp } = await prepareData(validator, 0, await blockTimestamp(), root);
      await contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]);

      await mintBlocks(blockPadding);

      await mockSubmit();
      ({ r, s, v, dataTimestamp } = await prepareData(validator, 1, dataTimestamp + 1, root));
      await contract.connect(validator).submit(dataTimestamp, root, [], [], [v], [r], [s]);

      await contractRegistry.mock.getAddress.withArgs(toBytes32('Chain')).returns(contract.address);
      newChain = await contractFactory.deploy(contractRegistry.address, blockPadding);
    });

    it('expect to have no blocks', async () => {
      expect(await newChain.blocksCount()).to.eq(0);
    });

    it('expect to have offset', async () => {
      expect(await newChain.blocksCountOffset()).to.eq(2 + 1);
    });

    it('expect to have valid block height', async () => {
      expect(await contract.getBlockHeight()).to.eq(1);
      await mintBlocks(blockPadding);
      expect(await contract.getBlockHeight()).to.eq(2);
    });
  });
});
