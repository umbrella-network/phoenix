// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import "./interfaces/IER721Mintable.sol";
import "./Chain.sol";

contract MainChain is Chain {
  address public relayToken;

  address public homeGate;

  constructor(
    address _contractRegistry,
    uint16 _padding,
    uint16 _requiredSignatures
  ) public Chain(_contractRegistry, _padding, _requiredSignatures) {
    // relayToken = Registry(_contractRegistry).getAddress("RelayToken");
    // relayToken = _ierc721;

    // require(Ownable(relayToken).owner() == address(this), "Should be the owner");

    // homeGate = Registry(_contractRegistry).getAddress("HomeGate");
  }

  function setToken(address _token) external {
    relayToken = _token;
  }

  function setHomeGate(address _homeGate) external {
    homeGate = _homeGate;
  }

  function submit(
    uint32 _dataTimestamp,
    bytes32 _root,
    bytes32[] memory _keys,
    uint256[] memory _values,
    uint8[] memory _v,
    bytes32[] memory _r,
    bytes32[] memory _s
  ) public override {
    uint32 lastBlockId = getLatestBlockId();

    require(blocks[lastBlockId].dataTimestamp + padding < block.timestamp, "do not spam");
    require(blocks[lastBlockId].dataTimestamp < _dataTimestamp, "can NOT submit older data");
    // we can't expect minter will have exactly the same timestamp
    // but for sure we can demand not to be off by a lot, that's why +3sec
    // temporary remove this condition, because recently on ropsten we see cases when minter/node
    // can be even 100sec behind
    // require(_dataTimestamp <= block.timestamp + 3,
    //   string(abi.encodePacked("oh, so you can predict the future:", _dataTimestamp - block.timestamp + 48)));
    require(_keys.length == _values.length, "numbers of keys and values not the same");

    bytes memory testimony = abi.encodePacked(_dataTimestamp, _root);

    for (uint256 i = 0; i < _keys.length; i++) {
      require(uint224(_values[i]) == _values[i], "FCD overflow");
      fcds[_keys[i]] = FirstClassData(uint224(_values[i]), _dataTimestamp);
      testimony = abi.encodePacked(testimony, _keys[i], _values[i]);
    }

    bytes32 affidavit = keccak256(testimony);
    uint256 power = 0;

    uint256 staked = stakingBank.totalSupply();
    address prevSigner = address(0x0);

    uint256 i = 0;

    for (; i < _v.length; i++) {
      address signer = recoverSigner(affidavit, _v[i], _r[i], _s[i]);
      uint256 balance = stakingBank.balanceOf(signer);

      require(prevSigner < signer, "validator included more than once");
      prevSigner = signer;
      if (balance == 0) continue;

      emit LogVoter(lastBlockId + 1, signer, balance);
      power += balance; // no need for safe math, if we overflow then we will not have enough power
    }

    require(i >= requiredSignatures, "not enough signatures");
    require(power * 100 / staked >= 66, "not enough power was gathered");

    blocks[lastBlockId + 1] = Block(_root, _dataTimestamp);
    blocksCount++;

    bytes32 affidavitEx = keccak256(abi.encodePacked(testimony, lastBlockId + 1));

    // mint an NFT token
    IER721Mintable(relayToken).mintTo(homeGate, ValueDecoder.toUint(affidavitEx));

    emit LogMint(msg.sender, lastBlockId + 1, staked, power);
  }
}
