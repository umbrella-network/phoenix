// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

// please remember this is our dummy token!
// it will be replaced by proper DPoS solution in future
contract i721 is ERC721 {
  constructor (string memory name, string memory symbol) public ERC721(name, symbol) {
  }

  function mint(uint256 tokenId) external {
    _mint(msg.sender, tokenId);
  }

  function mintTo(address to, uint256 tokenId) external {
    _mint(to, tokenId);
  }
}
