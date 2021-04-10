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
import { mintBlocks } from '../utils';

const { toWei } = hre.web3.utils;

use(waffleChai);

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
  dataTimestamp: number,
  root: string | null,
  fcdKeys: string[] = [],
  fcdValues: number[] = []
) => {
  let testimony = ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes32'], [dataTimestamp, root]);

  for (let i = 0; i < fcdKeys.length; i++) {
    testimony += ethers.utils.defaultAbiCoder.encode(['bytes32', 'uint256'], [fcdKeys[i], fcdValues[i]]).slice(2);
  }

  const hashForSolidity = ethers.utils.keccak256(testimony);
  const affidavit = ethers.utils.arrayify(hashForSolidity);

  const sig = await signer.signMessage(affidavit);
  const { r, s, v } = ethers.utils.splitSignature(sig);

  return { testimony, affidavit, sig, r, s, v, hashForSolidity };
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

  const executeSubmit = async (dataTimestamp = Math.trunc(Date.now() / 1000)) => {
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
      const { sig, affidavit, r, s, v, hashForSolidity } = await prepareData(validator, 0, root);

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
    [1, 2, 3, 4].forEach((numberOfValidators) => {
      it(`expect to return valid index for ${numberOfValidators}`, async () => {
        const id = (
          await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())
        ).toNumber();

        expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
          id,
          'round #1'
        );
        await mintBlocks(blockPadding);
        expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
          (id + 1) % numberOfValidators,
          'round #2'
        );
        await mintBlocks(blockPadding);
        expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
          (id + 2) % numberOfValidators,
          'round #3'
        );
        await mintBlocks(blockPadding);
        expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
          (id + 3) % numberOfValidators,
          'round #4'
        );
      });
    });

    describe('when block was minted', () => {
      beforeEach(async () => {
        await executeSubmit(1);
      });

      [1, 2, 3, 4].forEach((numberOfValidators) => {
        it(`expect to return valid index for ${numberOfValidators}`, async () => {
          const id = (
            await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())
          ).toNumber();

          expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
            id,
            'round #1'
          );
          await mintBlocks(blockPadding);
          expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
            (id + 1) % numberOfValidators,
            'round #2'
          );
          await mintBlocks(blockPadding);
          expect(await contract.getLeaderIndex(numberOfValidators, await ethers.provider.getBlockNumber())).to.eq(
            (id + 2) % numberOfValidators,
            'round #3'
          );
          await mintBlocks(blockPadding);
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
        const { r, s, v } = await prepareData(validator, 1, root);

        await expect(contract.connect(validator).submit(1, root, [], [], [v], [r], [s])).not.to.be.reverted;
        console.log(await contract.blocks(0));
      });

      it('fail when signature do not match', async () => {
        await mockSubmit();
        const { r, s, v } = await prepareData(validator, 1, root);

        const differentRoot = '0x00000000000000000000000000000000000000000000000000000000000001';
        await expect(contract.connect(validator).submit(1, differentRoot, [], [], [v], [r], [s])).to.be.reverted;
      });

      describe('when block submitted', () => {
        beforeEach(async () => {
          await mockSubmit();
          const { r, s, v } = await prepareData(validator, 1, root);
          await contract.connect(validator).submit(1, root, [], [], [v], [r], [s]);
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

        it('expect to get FCD', async () => {
          const bytes32 = `0x${'0'.repeat(64)}`;
          const fcds = await contract.getNumericFCDs(0, [bytes32]);
          console.log(fcds);
          expect(fcds[0]).to.eql([BigNumber.from(0)]);
          expect(fcds.timestamp).to.gt(0);
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

        describe('when still on the same timestamp', () => {
          it('expect submit to be reverted', async () => {
            await mockSubmit();
            const { r, s, v } = await prepareData(validator, 1, root);
            await expect(contract.connect(validator).submit(1, root, [], [], [v], [r], [s])).to.revertedWith(
              'revert can NOT submit older data'
            );
          });

          describe('when minimal padding reached', () => {
            beforeEach(async () => {
              await contract.setBlockPadding(1);
              await mintBlocks();
            });

            describe('when block mined for new time', () => {
              beforeEach(async () => {
                await contract.setBlockPadding(1);
                await executeSubmit(2);
                await contract.setBlockPadding(100);
              });

              it('expect to revert when submit again for same time', async () => {
                await mockSubmit();
                const { r, s, v } = await prepareData(validator, 2, root);
                await expect(contract.connect(validator).submit(2, root, [], [], [v], [r], [s])).to.revertedWith(
                  'can NOT submit older data'
                );
              });
            });
          });
        });
      });
    });

    describe('with FCD', () => {
      const fcdKeys = [toBytes32('a'), toBytes32('b')];
      const fcdValues = [1, 2];

      describe('when block submitted', () => {
        beforeEach(async () => {
          await mockSubmit();
          const { r, s, v } = await prepareData(validator, 1, root, fcdKeys, fcdValues);

          await expect(contract.connect(validator).submit(1, root, fcdKeys, fcdValues, [v], [r], [s])).to.emit(
            contract,
            'LogMint'
          );
        });

        it('expect to get First Class Data', async () => {
          const fcds = await contract.getNumericFCDs(0, [fcdKeys[0]]);
          console.log(fcds);
          expect(fcds[0]).to.eql([BigNumber.from(fcdValues[0])]);
          expect(fcds.timestamp).to.gt(0);
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
    let { r, s, v } = await prepareData(validator, 1, root);
    await contract.connect(validator).submit(1, root, [], [], [v], [r], [s]);

    await mintBlocks(blockPadding);

    await mockSubmit();
    ({ r, s, v } = await prepareData(validator, 2, root));
    await contract.connect(validator).submit(2, root, [], [], [v], [r], [s]);

    await contractRegistry.mock.getAddress.withArgs(toBytes32('ValidatorRegistry')).returns(validatorRegistry.address);

    await validatorRegistry.mock.getNumberOfValidators.returns(1);
    await validatorRegistry.mock.addresses.withArgs(0).returns(validatorAddress);
    await validatorRegistry.mock.validators.withArgs(validatorAddress).returns(validatorAddress, 'abc');
    await contractRegistry.mock.getAddress.withArgs(toBytes32('StakingBank')).returns(stakingBank.address);
    await stakingBank.mock.totalSupply.returns(123);
    await stakingBank.mock.balanceOf.withArgs(validatorAddress).returns(321);

    await mintBlocks(blockPadding);

    const status = await contract.getStatus();

    expect(status.lastDataTimestamp).to.eq(2);
    expect(status.lastBlockId).to.eq(1);
    expect(status.nextLeader).to.eq(validatorAddress);
    expect(status.validators).to.eql([validatorAddress]);
    expect(status.powers).to.eql([BigNumber.from(321)]);
    expect(status.locations).to.eql(['abc']);
    expect(status.staked).to.eq(123);
    expect(status.readyForNextBlock).to.be.true;
  });

  describe('update/replace contract', () => {
    let newChain: Contract;

    beforeEach(async () => {
      await mockSubmit();
      let { r, s, v } = await prepareData(validator, 1, root);
      await contract.connect(validator).submit(1, root, [], [], [v], [r], [s]);

      await mintBlocks(blockPadding);

      await mockSubmit();
      ({ r, s, v } = await prepareData(validator, 2, root));
      await contract.connect(validator).submit(2, root, [], [], [v], [r], [s]);

      await mintBlocks(blockPadding);

      await contractRegistry.mock.getAddress.withArgs(toBytes32('Chain')).returns(contract.address);
      await contractRegistry.mock.getAddress
        .withArgs(toBytes32('ValidatorRegistry'))
        .returns(validatorRegistry.address);
      await validatorRegistry.mock.getNumberOfValidators.returns(0);
      await contractRegistry.mock.getAddress.withArgs(toBytes32('StakingBank')).returns(stakingBank.address);
      await stakingBank.mock.totalSupply.returns(1);
      newChain = await contractFactory.deploy(contractRegistry.address, blockPadding);
    });

    it('expect to have no blocks', async () => {
      expect(await newChain.blocksCount()).to.eq(0);
    });

    it('expect to have offset', async () => {
      expect(await newChain.blocksCountOffset()).to.eq(2 + 1);
    });

    it('expect to have valid blockId', async () => {
      expect(await contract.getLatestBlockId()).to.eq(1);
      await mintBlocks(blockPadding);
      expect(await contract.getLatestBlockId()).to.eq(1);
    });
  });
});
