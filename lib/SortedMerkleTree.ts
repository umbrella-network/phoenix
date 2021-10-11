import { SortedMerkleTree as Tree } from '@umb-network/toolbox';

class SortedMerkleTree extends Tree {
  getFlatProofsForKeys(keys: string[] = []): {proofs: string, proofItemsCounter: number[]} {
    const proofItemsCounter: number[] = [];

    const proofs = '0x' + keys.map(key => {
      const proof = this.getProofForKey(key);
      proofItemsCounter.push(proof.length);
      return proof.map(item => item.slice(2)).join('');
    }).join('');

    return {proofs, proofItemsCounter};
  }

  getLeafForKey(key: string): string {
    const idx = this.getIndexForKey(key);
    return this.getLeaves()[idx];
  }

  // TODO move this to SDK
  getRootSquashed(timestamp: number): string {
    return this.getRoot().slice(0, 58) + timestamp.toString(16);
  }
}

export default SortedMerkleTree;
