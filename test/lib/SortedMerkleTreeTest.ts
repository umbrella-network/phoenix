import { ethers } from 'hardhat';
import { use, expect } from 'chai';

import { ContractFactory, Contract } from 'ethers';
import { waffleChai } from '@ethereum-waffle/chai';
import { LeafKeyCoder, LeafValueCoder } from '@umb-network/toolbox';
import { deployMockContract } from '@ethereum-waffle/mock-contract';

import SortedMerkleTree from '../../lib/SortedMerkleTree';
import Chain from '../../artifacts/contracts/Chain.sol/Chain.json';
import Registry from '../../artifacts/contracts/Registry.sol/Registry.json';
import { toBytes32 } from '../../scripts/utils/helpers';

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
      const v = LeafValueCoder.encode(1234567890, 'label');

      expect(await contract.hashLeaf(k, v)).to.eq(tree.leafHash(k, v));
    });
  });

  describe('getRoot()', () => {
    it('expect to have different root for different data', async () => {
      const tree1 = new SortedMerkleTree({ a: LeafValueCoder.encode(1, 'label') });
      const tree2 = new SortedMerkleTree({ a: LeafValueCoder.encode(2, 'lable') });
      expect(tree1.getRoot()).not.to.eq(tree2.getRoot());
    });
  });

  describe('with one element', () => {
    const key = 'eth-usd';
    const data = { [key]: LeafValueCoder.encode(123, 'label') };
    const tree = new SortedMerkleTree(data);

    it('expect leaf === tree', async () => {
      expect(tree.createLeafHash(key)).to.eq(tree.getRoot());
    });

    it('expect to validate proof off-chain', async () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(tree.verifyProof(tree.getProofForKey(key), tree.getRoot()!, tree.getLeafForKey(key))).to.be.true;
    });

    it('expect to validate proof on-chain', async () => {
      const proof = tree.getProofForKey(key);
      const leaf = tree.createLeafHash(key);
      expect(await contract.verifyProof(proof, tree.getRoot(), leaf)).to.be.true;
    });
  });

  describe('with multiple elements', () => {
    const data: Record<string, Buffer> = {};

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

    keys.sort().forEach((k) => {
      data[k] = LeafValueCoder.encode(Math.round(Math.random() * 1000), 'label');
    });

    const tree = new SortedMerkleTree(data);
    console.log(tree);

    it('keys order should not matter', async () => {
      const dataReverse: Record<string, Buffer> = {};

      keys.reverse().forEach((k) => {
        dataReverse[k] = data[k];
      });

      const treeReverse = new SortedMerkleTree(dataReverse);

      expect(tree.getRoot()).to.eq(treeReverse.getRoot());
    });

    it('expect to validate proof for all keys', async () => {
      const awaits: boolean[] = [];

      Object.keys(data).forEach((k) => {
        const proof = tree.getProofForKey(k);
        const leaf = tree.createLeafHash(k);
        const root = tree.getRoot();

        if (!root) {
          throw Error('root is missing');
        }

        expect(tree.verifyProof(proof, root, leaf)).to.be.true;
        awaits.push(contract.verifyProof(proof, tree.getRoot(), leaf));
      });

      expect((await Promise.all(awaits)).every((result) => result)).to.be.true;
    });
  });
});
