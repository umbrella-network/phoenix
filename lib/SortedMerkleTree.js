const {LeafKeyCoder} = require('@umb-network/toolbox');
const bre = require('@nomiclabs/buidler');
const {ethers} = bre;
const hash = ethers.utils.solidityKeccak256;
const lastHash = '0x' + 'f'.repeat(64);
const isOdd = n => n % 2 !== 0;

class SortedMerkleTree {
  /**
   *
   * @param keyValuePairs {Object} pairs of: string => buffer
   */
  constructor(keyValuePairs) {
    this.keys = {};
    this.data = keyValuePairs;
    this.tree = [];

    if (Object.keys(this.data).length > 0) {
      this.createTree(this.addEvenHash(this.createLeaves(this.data)));
    }
  }

  hashIt(h1, h2) {
    const sorted = [h1, h2].sort();
    return hash(['bytes32', 'bytes32'], [sorted[0], sorted[1]]);
  }

  hashLeaf(k, v) {
    return hash(['bytes', 'bytes'], [k, v]);
  }

  createLeafHash(k) {
    return this.hashLeaf(LeafKeyCoder.encode(k), this.data[k]);
  }

  addEvenHash(hashes) {
    if (hashes.length > 1 && isOdd(hashes.length)) {
      hashes.push(lastHash);
    }

    return hashes;
  }

  createLeaves(keyValuePairs) {
    return Object.keys(keyValuePairs).sort().map((k, i) => {
      const leafId = this.createLeafHash(k);
      this.keys[k] = i;
      return leafId;
    });
  }

  createNextTreeLevel(inputs) {
    const hashes = [];

    for (let i = 0; i + 1 < inputs.length; i += 2) {
      hashes.push(this.hashIt(inputs[i], inputs[i + 1]));
    }

    return hashes;
  }

  createTree(inputs) {
    this.tree.push(inputs);

    if (inputs.length > 1) {
      const nextLevelInputs = this.createNextTreeLevel(inputs);
      this.createTree(this.addEvenHash(nextLevelInputs));
    }
  }

  getLeaves() {
    return this.tree.length > 0 ? this.tree[0] : [];
  }

  getLeafForKey(key) {
    const idx = this.getIndexForKey(key);
    return this.getLeaves()[idx];
  }

  getIndexForKey(key) {
    return this.keys[key];
  }

  generateProof(idx, level = 0, proof = []) {
    if (level === this.tree.length - 1) {
      return proof;
    }

    const treeLevel = this.tree[level];
    const siblingIdx = idx + (isOdd(idx) ? -1 : +1);
    proof.push(treeLevel[siblingIdx]);

    return this.generateProof(Math.floor(idx / 2), level + 1, proof);
  }


  getFlatProofsForKeys(keys = []) {
    const proofItemsCounter = [];

    const proofs = '0x' + keys.map(key => {
      const proof = this.getProofForKey(key);
      proofItemsCounter.push(proof.length);
      return proof.map(item => item.slice(2)).join('');
    }).join('');

    return {proofs, proofItemsCounter};
  }

  getProofForKey(key) {
    return this.generateProof(this.getIndexForKey(key));
  }

  getHexRoot() {
    if (this.tree.length === 0) {
      return null;
    }

    return this.tree[this.tree.length - 1][0];
  }

  verifyProof(proof, root, leaf) {
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

module.exports = SortedMerkleTree;
