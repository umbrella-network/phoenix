import {ethers} from 'hardhat';
import {use, expect} from 'chai';

import {ContractFactory, Contract} from 'ethers';
import {waffleChai} from '@ethereum-waffle/chai';
import {LeafKeyCoder, LeafValueCoder, LeafType} from '@umb-network/toolbox';

import SortedMerkleTree from '../../lib/SortedMerkleTree';

import Chain from '../../artifacts/contracts/Chain.sol/Chain.json';
import {deployMockContract} from '@ethereum-waffle/mock-contract';
import Registry from '../../artifacts/contracts/Registry.sol/Registry.json';
import {toBytes32} from '../../scripts/utils/helpers';

use(waffleChai);

describe('Tree', () => {
  let contract: Contract;

  before(async () => {
    const [owner] = await ethers.getSigners();
    const contractRegistry = await deployMockContract(owner, Registry.abi);
    const chain = new ContractFactory(Chain.abi, Chain.bytecode, owner);

    await contractRegistry.mock.getAddress.withArgs(toBytes32('Chain')).returns(ethers.constants.AddressZero);
    contract = await chain.deploy(contractRegistry.address, 1);
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
      expect(tree.verifyProof(tree.getProofForKey(key), tree.getHexRoot()!, tree.getLeafForKey(key))).to.be.true;
    });

    it('expect to validate proof on-chain', async () => {
      const proof = tree.getProofForKey(key);
      const leaf = tree.createLeafHash(key);
      expect(await contract.verifyProof(proof, tree.getHexRoot(), leaf)).to.be.true;
    });
  });

  describe('with multiple elements', () => {
    const data: Record<string, Buffer> = {};

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
      const dataReverse: Record<string, Buffer> = {};

      keys.reverse().forEach(k => {
        dataReverse[k] = data[k];
      });

      const treeReverse = new SortedMerkleTree(dataReverse);

      expect(tree.getHexRoot()).to.eq(treeReverse.getHexRoot());
    });

    it('expect to validate proof for all keys', async () => {
      const awaits: any[] = [];

      Object.keys(data).forEach(k => {
        const proof = tree.getProofForKey(k);
        const leaf = tree.createLeafHash(k);

        expect(tree.verifyProof(proof, tree.getHexRoot()!, leaf)).to.be.true;
        awaits.push(contract.verifyProof(proof, tree.getHexRoot(), leaf));
      });

      expect((await Promise.all(awaits)).every(result => result)).to.be.true;
    });
  });
});
