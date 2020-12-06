const {use, expect} = require('chai');
const {ContractFactory} = require('ethers');
const {waffleChai} = require('@ethereum-waffle/chai');
const {LeafKeyCoder, LeafValueCoder, LeafType} = require('@umb-network/toolbox');

const SortedMerkleTree = require('../../lib/SortedMerkleTree');

const Chain = require('../../artifacts/Chain');

use(waffleChai);

describe('Tree', () => {
  let contract;

  before(async () => {
    const [owner] = await ethers.getSigners();
    const contractFactory = new ContractFactory(Chain.abi, Chain.bytecode, owner);

    contract = await contractFactory.deploy(
      '0x0000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000002',
      1
    );
  });

  describe('hashLeaf()', () => {
    it('expect to return hashed leaf', async () => {
      const tree = new SortedMerkleTree({});
      const k = LeafKeyCoder.encode('etc-usd');
      const v = LeafValueCoder.encode(1234567890, LeafType.TYPE_INTEGER);

      expect(await contract.hashLeaf(k, v)).to.eq(tree.hashLeaf(k, v));
    });
  });

  describe('getHexRoot()', () => {
    it('expect to have different root for different data', async () => {
      const tree1 = new SortedMerkleTree({'a': LeafValueCoder.encode(1, LeafType.TYPE_INTEGER)});
      const tree2 = new SortedMerkleTree({'a': LeafValueCoder.encode(2, LeafType.TYPE_INTEGER)});
      expect(tree1.getHexRoot()).not.to.eq(tree2.getHexRoot());
    });
  });

  describe('with one element', () => {
    const key = 'eth-usd';
    const data = {[key]: LeafValueCoder.encode(123, LeafType.TYPE_INTEGER)};
    const tree = new SortedMerkleTree(data);

    it('expect leaf === tree', async () => {
      expect(tree.createLeafHash(key)).to.eq(tree.getHexRoot());
    });

    it('expect to validate proof off-chain', async () => {
      expect(tree.verifyProof(tree.getProofForKey(key))).to.be.true;
    });

    it('expect to validate proof on-chain', async () => {
      const proof = tree.getProofForKey(key);
      const leaf = tree.createLeafHash(key);
      expect(await contract.verifyProof(proof, tree.getHexRoot(), leaf)).to.be.true;
    });
  });

  describe('with multiple elements', () => {
    const data = {};

    const keys = [
      'eth-eur', 'btc-eur', 'war-eur', 'ltc-eur', 'uni-eur',
      'eth-usd', 'btc-usd', 'war-usd', 'ltc-usd', 'uni-usd',
    ];

    keys.sort().forEach(k => {
      data[k] = LeafValueCoder.encode(Math.round(Math.random() * 1000), LeafType.TYPE_INTEGER);
    });

    const tree = new SortedMerkleTree(data);
    console.log(tree);

    it('keys order should not matter', async () => {
      const dataReverse = {};

      keys.reverse().forEach(k => {
        dataReverse[k] = data[k];
      });

      const treeReverse = new SortedMerkleTree(dataReverse);

      expect(tree.getHexRoot()).to.eq(treeReverse.getHexRoot());
    });

    it('expect to validate proof for all keys', async () => {
      const awaits = [];

      Object.keys(data).forEach(k => {
        const proof = tree.getProofForKey(k);
        const leaf = tree.createLeafHash(k);

        expect(tree.verifyProof(proof, tree.getHexRoot(), leaf)).to.be.true;
        awaits.push(contract.verifyProof(proof, tree.getHexRoot(), leaf));
      });

      expect((await Promise.all(awaits)).every(result => result)).to.be.true;
    });
  });
});
