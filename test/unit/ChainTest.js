const bre = require('@nomiclabs/buidler');
const {ethers} = bre;
const {use, expect} = require('chai');
const {ContractFactory, BigNumber} = require('ethers');
const {waffleChai} = require('@ethereum-waffle/chai');
const {deployMockContract} = require('@ethereum-waffle/mock-contract');
const {loadFixture} = require('ethereum-waffle');
const {LeafKeyCoder, LeafValueCoder, LeafType} = require('@umb-network/toolbox');

const SortedMerkleTree = require('../../lib/SortedMerkleTree');

const Registry = require('../../artifacts/Registry');
const Chain = require('../../artifacts/Chain');
const ValidatorRegistry = require('../../artifacts/ValidatorRegistry');
const StakingBank = require('../../artifacts/StakingBank');
const Token = require('../../artifacts/Token');
const {toBytes32} = require('../../scripts/helpers');
const {toWei} = bre.web3.utils;

use(waffleChai);

const blockPadding = 100;

async function fixture([owner, validator]) {
  const token = await deployMockContract(owner, Token.abi);
  const contractRegistry = await deployMockContract(owner, Registry.abi);
  const validatorRegistry = await deployMockContract(owner, ValidatorRegistry.abi);
  const stakingBank = await deployMockContract(owner, StakingBank.abi);
  const contractFactory = new ContractFactory(Chain.abi, Chain.bytecode, owner);

  const contract = await contractFactory.deploy(contractRegistry.address, blockPadding);

  return {
    owner,
    validator,
    token,
    contractRegistry,
    validatorRegistry,
    stakingBank,
    contract
  };
}

const inputs = {};

const keys = [
  'eth-eur', 'btc-eur', 'war-eur', 'ltc-eur', 'uni-eur',
  'eth-usd', 'btc-usd', 'war-usd', 'ltc-usd', 'uni-usd',
];

keys.forEach((k, i) => {
  inputs[k] = LeafValueCoder.encode(i + 1, LeafType.TYPE_INTEGER);
});

const tree = new SortedMerkleTree(inputs);
const root = tree.getHexRoot();

const prepareData = async (signer, blockHeight, root, fcdKeys = [], fcdValues = []) => {
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

describe('Chain', () => {
  let owner, validator, contractRegistry, validatorRegistry, stakingBank, contract;

  const mockSubmit = async (leader = validator, numberOfValidators = 1, totalSupply = 1000, balance = 1000) => {
    await contractRegistry.mock.requireAndGetAddress.withArgs(toBytes32('ValidatorRegistry')).returns(validatorRegistry.address);
    await validatorRegistry.mock.getNumberOfValidators.returns(numberOfValidators);
    await validatorRegistry.mock.addresses.returns(leader.address);
    await contractRegistry.mock.requireAndGetAddress.withArgs(toBytes32('StakingBank')).returns(stakingBank.address);
    await stakingBank.mock.totalSupply.returns(totalSupply);
    await stakingBank.mock.balanceOf.withArgs(leader.address).returns(balance);
  };

  beforeEach(async () => {
    ({
      owner,
      validator,
      contractRegistry,
      validatorRegistry,
      stakingBank,
      contract
    } = await loadFixture(fixture));
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
  });

  describe('setBlockPadding()', () => {
    it('expect to set block padding', async () => {
      await expect(contract.setBlockPadding(9))
        .to.emit(contract, 'LogBlockPadding').withArgs(await owner.getAddress(), 9);

      expect(await contract.blockPadding()).to.eq(9);
    });

    it('expect to throw when call from NOT an owner', async () => {
      await expect(contract.connect(validator).setBlockPadding(9))
        .to.revertedWith('revert Ownable: caller is not the owner');
    });
  });

  describe('recoverSigner()', () => {
    it('expect to return signer', async () => {
      const {sig, affidavit, r, s, v, hashForSolidity} = await prepareData(validator, 0, root);

      const signer = await contract.recoverSigner(hashForSolidity, v, r, s);

      expect(signer).to.eq(validator.address);
      expect(await ethers.utils.verifyMessage(affidavit, sig)).to.eq(validator.address);
    });
  });

  describe('bytesToBytes32Array()', () => {
    it('expect to convert bytes to array of bytes32', async () => {
      const arr = ['1', '2', '3'].map(str => `0x${str.padStart(64, '0')}`);
      const bytes = '0x' + arr.map(item => item.slice(2)).join('');
      expect(await contract.bytesToBytes32Array(bytes, 0, arr.length)).to.eql(arr);
    });

    it('expect to slice bytes by offset', async () => {
      const arr = ['1', '2', '3'].map(str => `0x${str.padStart(64, '0')}`);
      const bytes = '0x' + arr.map(item => item.slice(2)).join('');
      expect(await contract.bytesToBytes32Array(bytes, 2, 1)).to.eql([arr[2]]);
    });
  });

  describe('.decodeLeafToNumber()', () => {
    [
      '0', '1', '2', '999', Number.MAX_SAFE_INTEGER.toString(10),
      // @todo not supported yet max uint256
      // '115792089237316195423570985008687907853269984665640564039457584007913129639935',
      // '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
    ].forEach(data => {
      it(`expect ${data} to be decoded properly to number`, async () => {
        const bytes = LeafValueCoder.encode(data, LeafType.TYPE_INTEGER);
        const result = await contract.decodeLeafToNumber(bytes);
        expect(result).to.eq(data);
      });
    });

    describe('throws when', () => {
      it('bytes are empty', async () => {
        await expect(contract.decodeLeafToNumber('0x00')).to.revertedWith('revert invalid leaf bytes - missing type metadata');
      });

      it('missing metadata type marker', async () => {
        await expect(contract.decodeLeafToNumber('0x1111111111')).to.revertedWith('revert invalid leaf - missing type marker');
      });

      it('invalid type', async () => {
        const bytes = LeafValueCoder.encode('1', LeafType.TYPE_FLOAT);
        await expect(contract.decodeLeafToNumber(bytes)).to.revertedWith('revert invalid leaf - invalid type - expect 02:int');
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
      '0.900719925474099': '900719925474099000'
    }).forEach(data => {
      it(`expect ${data[0]} to be decoded correctly to float: ${data[1]}`, async () => {
        const bytes = LeafValueCoder.encode(data[0], LeafType.TYPE_FLOAT);
        const result = await contract.decodeLeafToFloat(bytes);
        expect(result.toString()).to.eq(data[1]);
      });
    });

    describe('throws when', () => {
      it('bytes are empty', async () => {
        await expect(contract.decodeLeafToFloat('0x00')).to.revertedWith('revert invalid leaf bytes - missing type metadata');
      });

      it('missing metadata type marker', async () => {
        await expect(contract.decodeLeafToFloat('0x1111111111')).to.revertedWith('revert invalid leaf - missing type marker');
      });

      it('invalid type', async () => {
        const bytes = LeafValueCoder.encode('1', LeafType.TYPE_INTEGER);
        await expect(contract.decodeLeafToFloat(bytes)).to.revertedWith('revert invalid leaf - invalid type - expect 03:float');
      });
    });
  });

  describe('.submit()', () => {
    describe('without FCD', () => {
      it('expect to mint a block', async () => {
        await mockSubmit();
        const {r, s, v} = await prepareData(validator, 0, root);

        await expect(contract.connect(validator).submit(root, [], [], [v], [r], [s])).not.to.be.reverted;
        console.log(await contract.blocks(0));
      });

      it('fail when signature do not match', async () => {
        await mockSubmit();
        const {r, s, v} = await prepareData(validator, 0, root);

        const differentRoot = '0x00000000000000000000000000000000000000000000000000000000000001';
        await expect(contract.connect(validator).submit(differentRoot, [], [], [v], [r], [s])).to.be.reverted;
      });

      describe('when block submitted', () => {
        beforeEach(async () => {
          await mockSubmit();
          const {r, s, v} = await prepareData(validator, 0, root);
          await contract.connect(validator).submit(root, [], [], [v], [r], [s]);
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

        it('expect to get FCD', async () => {
          const bytes32 = `0x${'0'.repeat(64)}`;
          expect(await contract.getMultipleNumericData(0, [bytes32])).to.eql([BigNumber.from(0)]);
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
            const {proofs, proofItemsCounter} = tree.getFlatProofsForKeys(keys);
            const leaves = keys.map(k => tree.getLeafForKey(k));
            const result = new Array(keys.length).fill(true);

            expect(await contract.verifyProofs(blockHeights, proofs, proofItemsCounter, leaves)).to.eql(result);
          });
        });

        describe('when still on the same block height', () => {
          it('expect submit to be reverted', async () => {
            await mockSubmit();
            const {r, s, v} = await prepareData(validator, 0, root);
            await expect(contract.connect(validator).submit(root, [], [], [v], [r], [s]))
              .to.revertedWith('revert block already mined for current blockHeight');
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
                await mockSubmit();
                const {r, s, v} = await prepareData(validator, 1, root);
                await contract.connect(validator).submit(root, [], [], [v], [r], [s]);
                await contract.setBlockPadding(100);
              });

              it('expect to revert when submit again for same block', async () => {
                await mockSubmit();
                const {r, s, v} = await prepareData(validator, 1, root);
                await expect(contract.connect(validator).submit(root, [], [], [v], [r], [s]))
                  .to.revertedWith('revert block already mined for current blockHeight');
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
          const {r, s, v} = await prepareData(validator, 0, root, fcdKeys, fcdValues);

          await expect(contract.connect(validator).submit(root, fcdKeys, fcdValues, [v], [r], [s]))
            .to.emit(contract, 'LogMint');
        });

        it('expect to get First Class Data', async () => {
          expect(await contract.getMultipleNumericData(0, [fcdKeys[0]])).to.eql([BigNumber.from(fcdValues[0])]);
          expect(await contract.getSingleNumericData(0, fcdKeys[0])).to.eql(BigNumber.from(fcdValues[0]));
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
});
