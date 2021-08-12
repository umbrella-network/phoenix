//SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IER721Mintable is IERC721 {
  function mint(uint256 tokenId) external;

  function mintTo(address to, uint256 tokenId) external;
}
