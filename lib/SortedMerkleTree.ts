import '@nomiclabs/hardhat-ethers';
import {LeafKeyCoder} from '@umb-network/toolbox';
import {ethers} from 'ethers';

const hash = ethers.utils.solidityKeccak256;
const lastHash = ethers.constants.HashZero;
const isOdd = (n: number) => n % 2 !== 0;

class SortedMerkleTree {
  public keys: Record<string, number>;
  public data: Record<string, Buffer>;
  public tree: string[][];

  /**
   *
   * @param keyValuePairs {Object} pairs of: string => buffer
   */
  constructor(keyValuePairs: Record<string, Buffer>) {
    this.keys = {};
    this.data = keyValuePairs;
    this.tree = [];

    if (Object.keys(this.data).length > 0) {
      this.createTree(this.addEvenHash(this.createLeaves(this.data)));
    }
  }

  hashIt(h1: string, h2: string): string {
    const sorted = [h1, h2].sort();
    return hash(['bytes32', 'bytes32'], [sorted[0], sorted[1]]);
  }

  hashLeaf(k: Buffer, v: Buffer): string {
    return hash(['bytes', 'bytes'], [k, v]);
  }

  createLeafHash(k: string): string {
    return this.hashLeaf(LeafKeyCoder.encode(k), this.data[k]);
  }

  addEvenHash(hashes: string[]): string[] {
    if (hashes.length > 1 && isOdd(hashes.length)) {
      hashes.push(lastHash);
    }

    return hashes;
  }

  createLeaves(keyValuePairs: Record<string, Buffer>): string[] {
    return Object.keys(keyValuePairs).sort().map((k, i) => {
      const leafId = this.createLeafHash(k);
      this.keys[k] = i;
      return leafId;
    });
  }

  createNextTreeLevel(inputs: string[]): string[] {
    const hashes = [];

    for (let i = 0; i + 1 < inputs.length; i += 2) {
      hashes.push(this.hashIt(inputs[i], inputs[i + 1]));
    }

    return hashes;
  }

  createTree(inputs: string[]): void {
    this.tree.push(inputs);

    if (inputs.length > 1) {
      const nextLevelInputs = this.createNextTreeLevel(inputs);
      this.createTree(this.addEvenHash(nextLevelInputs));
    }
  }

  getLeaves(): string[] {
    return this.tree.length > 0 ? this.tree[0] : [];
  }

  getLeafForKey(key: string): string {
    const idx = this.getIndexForKey(key);
    return this.getLeaves()[idx];
  }

  getIndexForKey(key: string): number {
    return this.keys[key];
  }

  generateProof(idx: number, level = 0, proof: string[] = []): string[] {
    if (level === this.tree.length - 1) {
      return proof;
    }

    const treeLevel = this.tree[level];
    const siblingIdx = idx + (isOdd(idx) ? -1 : +1);
    proof.push(treeLevel[siblingIdx]);

    return this.generateProof(Math.floor(idx / 2), level + 1, proof);
  }

  getFlatProofsForKeys(keys: string[] = []): {proofs: string, proofItemsCounter: number[]} {
    const proofItemsCounter: number[] = [];

    const proofs = '0x' + keys.map(key => {
      const proof = this.getProofForKey(key);
      proofItemsCounter.push(proof.length);
      return proof.map(item => item.slice(2)).join('');
    }).join('');

    return {proofs, proofItemsCounter};
  }

  getProofForKey(key: string): string[] {
    return this.generateProof(this.getIndexForKey(key));
  }

  getHexRoot(): string | null {
    if (this.tree.length === 0) {
      return null;
    }

    return this.tree[this.tree.length - 1][0];
  }

  verifyProof(proof: string[], root: string, leaf: string): boolean {
    let computedHash = leaf;

    proof.forEach(proofElement => {
      if (computedHash <= proofElement) {
        computedHash = this.hashIt(computedHash, proofElement);
      } else {
        computedHash = this.hashIt(proofElement, computedHash);
      }
    });

    return computedHash === root;
  }
}

export default SortedMerkleTree;
