//SPDX-License-Identifier: Unlicensed
pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";

library LeafDecoder {
  using SafeMath for uint256;

  function leafToUint(bytes memory _leafBytes) internal pure returns (uint256 number) {
    uint length = _leafBytes.length;
    require(length >= 2, "invalid leaf bytes - missing type metadata");
    require(_leafBytes[length - 2] == 0xFF, "invalid leaf - missing type marker");
    require(_leafBytes[length - 1] == 0x02, "invalid leaf - invalid type - expect 02:int");

    if (length == 2) {
      return 0;
    }

    length -= 2;

    for(uint i = 0; i < length; i++) {
      number = number + uint(uint8(_leafBytes[i])) * (2**(8*(length-(i+1))));
    }

    return number;
  }

  function leafTo18DecimalsFloat(bytes memory _leafBytes) internal pure returns (uint256 float){
    uint length = _leafBytes.length;
    require(length >= 3, "invalid leaf bytes - missing type metadata");
    require(_leafBytes[length - 2] == 0xFF, "invalid leaf - missing type marker");
    require(_leafBytes[length - 1] == 0x03, "invalid leaf - invalid type - expect 03:float");

    if (length == 3) {
      return 0;
    }

    uint power = 18;

    if (_leafBytes[length - 3] != 0xee) {
      require(length >= 4, "invalid leaf bytes - missing type metadata");

      power = 18 - uint(uint8(_leafBytes[length - 3]));
      length -= 4;
    } else {
      length -= 3;
    }

    for(uint i = 0; i < length; i++) {
      float = float + uint(uint8(_leafBytes[i])) * (2**(8*(length-(i+1))));
    }

    return float.mul(10 ** power);
  }
}
