// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

/**
 * @dev These functions deal with verification of Merkle trees (hash trees),
 *      based on openzeppelin/contracts/cryptography/MerkleProof.sol
 *      adjusted to support squashed root
 */
library MerkleProof {
  uint256 constant rootMask = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000;
  uint256 constant timestampMask = 0xffffffff;

  function extractSquashedData(bytes32 _rootTimestamp) internal pure returns (bytes32 root, uint32 dataTimestamp) {
    assembly {
      root := and(_rootTimestamp, rootMask)
      dataTimestamp := and(_rootTimestamp, timestampMask)
    }
  }

  function extractRoot(bytes32 _rootTimestamp) internal pure returns (bytes32 root) {
    assembly {
      root := and(_rootTimestamp, rootMask)
    }
  }

  function extractTimestamp(bytes32 _rootTimestamp) internal pure returns (uint32 dataTimestamp) {
    assembly {
      dataTimestamp := and(_rootTimestamp, timestampMask)
    }
  }

  function makeSquashedRoot(bytes32 _root, uint32 _timestamp) internal pure returns (bytes32 rootTimestamp) {
    assembly {
      rootTimestamp := or(and(_root, rootMask), _timestamp)
    }
  }

  /**
   * @dev Returns true if a `leaf` can be proved to be a part of a Merkle tree
   * defined by `root`. For this, a `proof` must be provided, containing
   * sibling hashes on the branch from the leaf to the root of the tree. Each
   * pair of leaves and each pair of pre-images are assumed to be sorted.
   */
  function verifySquashed(bytes32 squashedRoot, bytes32[] memory proof, bytes32 leaf) internal pure returns (bool) {
    return extractRoot(_computeRoot(proof, leaf)) == extractRoot(squashedRoot);
  }

  function verify(bytes32 root, bytes32[] memory proof, bytes32 leaf) internal pure returns (bool) {
    return _computeRoot(proof, leaf) == root;
  }

  function _computeRoot(bytes32[] memory proof, bytes32 leaf) internal pure returns (bytes32) {
    bytes32 computedHash = leaf;

    for (uint256 i = 0; i < proof.length; i++) {
      bytes32 proofElement = proof[i];

      if (computedHash <= proofElement) {
        // Hash(current computed hash + current element of the proof)
        computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
      } else {
        // Hash(current element of the proof + current computed hash)
        computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
      }
    }

    // Check if the computed hash (root) is equal to the provided root
    return computedHash;
  }
}
