pragma solidity ^0.6.8;

import "./Chain.sol";

contract User  {
  Chain umbrella;

  constructor(address _chain) public {
    umbrella = Chain(_chain);
  }

  bool[] validations;
  uint256[] prices;

  function umbrellaValidation(
    uint256 _blockHeight,
    bytes32[] memory _proof,
    bytes memory _key,
    bytes memory _value
  ) public {
    bool valid = umbrella.verifyProofForBlock(_blockHeight, _proof, _key, _value);
    require(valid, "data can't be verified");

    // do stuff here ...
    validations.push(valid);
  }

  function verifyProofs(
    uint256[] memory _blockHeights,
    bytes memory _proofs,
    uint256[] memory _proofItemsCounter,
    bytes32[] memory _leaves
  ) public {
    bool[] memory results = umbrella.verifyProofs(_blockHeights, _proofs, _proofItemsCounter, _leaves);

    for (uint i=0; i < results.length; i++) {
      require(results[i], "data can't be verified");

      validations.push(results[i]);
    }
  }

  function fcd(uint _blockHeight, bytes32[] memory _keys) public {
    uint256[] memory results = umbrella.getBlockFCD(_blockHeight, _keys);

    for (uint i=0; i < results.length; i++) {
      prices.push(results[i]);
    }
  }

  function fcdOne(uint _blockHeight, bytes32 _key) public {
    uint256 result = umbrella.getBlockFCDone(_blockHeight, _key);
    prices.push(result);
  }

  function tx() public {
    validations.push(true);
  }
}
