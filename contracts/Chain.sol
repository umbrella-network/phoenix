// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./lib/LeafDecoder.sol";
import "./interfaces/IStakingBank.sol";
import "./interfaces/IValidatorRegistry.sol";

import "./extensions/Registrable.sol";
import "./Registry.sol";

contract Chain is ReentrancyGuard, Registrable, Ownable {
  using SafeMath for uint256;
  using LeafDecoder for bytes;

  // ========== STATE VARIABLES ========== //

  uint256 public blockPadding;

  bytes constant public ETH_PREFIX = "\x19Ethereum Signed Message:\n32";

  struct Block {
    bytes32 root;
    address minter;
    uint256 staked;
    uint256 power;
    uint256 anchor;
    uint256 blockTimestamp;
    uint256 dataTimestamp;
  }

  struct ExtendedBlock {
    Block data;
    address[] voters;
    mapping(address => uint256) votes;
    mapping(bytes32 => uint256) numericFCD;
  }

  mapping(uint256 => ExtendedBlock) public blocks;

  uint256 public blocksCount;
  uint256 public blocksCountOffset;

  // ========== CONSTRUCTOR ========== //

  constructor(address _contractRegistry, uint256 _blockPadding) public Registrable(_contractRegistry) {
    blockPadding = _blockPadding;

    Chain oldChain = Chain(Registry(_contractRegistry).getAddress("Chain"));

    if (address(oldChain) != address(0x0)) {
      // +1 because it might be situation when tx is already in progress in old contract
      blocksCountOffset = oldChain.blocksCount() + oldChain.blocksCountOffset() + 1;
    }
  }

  // ========== MUTATIVE FUNCTIONS ========== //

  function setBlockPadding(uint256 _blockPadding) external onlyOwner {
    blockPadding = _blockPadding;
    emit LogBlockPadding(msg.sender, _blockPadding);
  }

  function submit(
    uint256 _dataTimestamp,
    bytes32 _root,
    bytes32[] memory _keys,
    uint256[] memory _values,
    uint8[] memory _v,
    bytes32[] memory _r,
    bytes32[] memory _s
  ) public nonReentrant returns (bool) {
    uint256 blockHeight = getBlockHeight();
    require(blocks[blockHeight].data.anchor == 0, "block already mined for current blockHeight");

    bytes memory testimony = abi.encodePacked(_dataTimestamp, blockHeight, _root);

    require(_keys.length == _values.length, "numbers of keys and values not the same");

    for (uint256 i = 0; i < _keys.length; i++) {
      blocks[blockHeight].numericFCD[_keys[i]] = _values[i];
      testimony = abi.encodePacked(testimony, _keys[i], _values[i]);
    }

    IStakingBank stakingBank = stakingBankContract();
    uint256 staked = stakingBank.totalSupply();
    uint256 power = 0;
    uint256 minimum = staked.mul(66);

    bytes32 affidavit = keccak256(testimony);

    address leaderAddress;

    for (uint256 i = 0; i < _v.length; i++) {
      address signer = recoverSigner(affidavit, _v[i], _r[i], _s[i]);
      uint256 balance = stakingBank.balanceOf(signer);

      if (balance == 0) {
        // if no balance -> move on
        // if we calculated root for other blockHeight then recovering signer will not work -> move on
        // if invalid signature for any reason -> move on
        // we don't have to reject tx because of above, the worst what can happen is if we move on, we spend more gas
        // so if validators wants to misbehave they will pay more
        continue;
      }

      // I remove requirement for leader, so now anyone can submit
      // that's ok because we do not care about leader really - data is what we care about

      // if we want to know the leader, we can assume, that leader signature will be set as first
      // so anyone who will be submitting tx, will set its own signature at begin
      // of course this is not 100% valid way of checking, because someone can scan pending tx, get data,
      // change order of signatures and submit tx with higher gas to become a leader... but why?
      // also, if this will be a problem, we can add some additional checks like: ask validators to sign leader address
      // and Chain will check that... but the only reason why we would like to know the leader is that he spend money
      // on tx and he should get paid more than others, to compensate that... but for that we need msg.sender only
      // so I dont see any reason why Chain have to check, if leader is the one who submitting data
      // leader selection is only important for validators, so they know who should submit

      // in case of holding data and use them in future - we can do it even now, removing leader check changes nothing
      // if validator get signatures and not sent block and noone else will be sending, the block can be mined in the future
      // the only fix for that is to add dataTimestamp, and we can do this in two ways:
      // 1. we wil add this dataTimestamp, validators will sign it, we put it in `block`
      //    and that's it, Chain will not check it - whoever will be using data should check it
      //    and decide if time of data is valid for them (I do like this approach)
      // 2. we can reject tx if dataTimestamp will be too old... but this make no sense to me - first of all,
      //    if validator hold data then we go to next round and new leader can submit, so helded data can't be use
      //    anymore even without this dataTimestamp check, they will be rejected because of blockHeight will be taken,
      //    majority of validators must be involve in holding data attack so it can work.

      // not checking leader also allow us to accept blocks even when new round will start.
      // see https://umbnetwork.slab.com/posts/po-c-for-umbrella-multichain-architecture-v-3-tu1k3yt8#what-if-validator-will-be-too-slow-and-will-send-tx-when-his-round-is-almost-over

      if (i = 0) {
        // for now we can assume first sig is a leader, because validator currently puts his sig on 1st place
        leaderAddress = signer;
      }

      if (blocks[blockHeight].votes[signer] != 0) {
        // "validator included more than once");
        // lets just ignore
        continue;
      }

      blocks[blockHeight].voters.push(signer);

      blocks[blockHeight].votes[signer] = balance;
      power = power.add(balance);

      // I don't want to stop when we reach required power because we loosing info how good or bad is our consensus
      // if we not break we will be able to see all voters that participated
      // if (power.mul(100) > minimum) {break;}
    }

    require(power.mul(100) > minimum, "not enough power was gathered");

    blocks[blockHeight].data.root = _root;
    blocks[blockHeight].data.minter = leaderAddress;
    blocks[blockHeight].data.staked = staked;
    blocks[blockHeight].data.power = power;
    blocks[blockHeight].data.anchor = block.number;
    blocks[blockHeight].data.timestamp = block.timestamp;

    blocksCount++;

    emit LogMint(msg.sender, blockHeight, block.number);

    return true;
  }

  // ========== VIEWS ========== //

  function getName() override external pure returns (bytes32) {
    return "Chain";
  }

  function recoverSigner(bytes32 affidavit, uint8 _v, bytes32 _r, bytes32 _s) public pure returns (address) {
    bytes32 hash = keccak256(abi.encodePacked(ETH_PREFIX, affidavit));
    return ecrecover(hash, _v, _r, _s);
  }

  function getBlockHeight() public view returns (uint256) {
    uint _blocksCount = blocksCount + blocksCountOffset;

    if (_blocksCount == 0) {
      return 0;
    }

    if (blocks[_blocksCount - 1].data.anchor + blockPadding < block.number) {
      return _blocksCount;
    }

    return _blocksCount - 1;
  }

  function getLatestBlockHeightWithData() public view returns (uint256) {
    return blocksCount + blocksCountOffset - 1;
  }

  function getLeaderIndex(uint256 numberOfValidators, uint256 ethBlockNumber)
  public view returns (uint256 leaderIndex, uint256 newBlockHeight) {
    uint256 latestBlockHeight = getLatestBlockHeightWithData();
    newBlockHeight = latestBlockHeight + (ethBlockNumber - blocks[latestBlockHeight].data.anchor) / blockPadding;
    leaderIndex = nextBlockHeight % numberOfValidators;
  }

  // when we return leader with blockHeight, validator can drop call for blockHeight
  // its not only optimization, most important here is fact, that in situation when eth blocks
  // goes like this: 1 2 3 4 >3< 4, we can avoid confusion about leader, whe blocks are not yet stable
  function getNextLeaderAddress() public view returns (address, uint256) {
    return getLeaderAddressAtBlock(block.number + 1);
  }

  function getLeaderAddress() public view returns (address, uint256) {
    return getLeaderAddressAtBlock(block.number);
  }

  // @todo - properly handled non-enabled validators, newly added validators, and validators with low stake
  function getLeaderAddressAtBlock(uint256 ethBlockNumber) public view returns (address, uint256) {
    IValidatorRegistry validatorRegistry = validatorRegistryContract();

    uint256 numberOfValidators = validatorRegistry.getNumberOfValidators();

    if (numberOfValidators == 0) {
      return address(0x0);
    }

    (uint256 validatorIndex, uint256 newBlockHeight) = getLeaderIndex(numberOfValidators, ethBlockNumber);

    return (validatorRegistry.addresses(validatorIndex), newBlockHeight);
  }

  function verifyProof(bytes32[] memory _proof, bytes32 _root, bytes32 _leaf) public pure returns (bool) {
    if (_root == bytes32(0)) {
      return false;
    }

    return MerkleProof.verify(_proof, _root, _leaf);
  }

  function hashLeaf(bytes memory _key, bytes memory _value) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(_key, _value));
  }

  function verifyProofForBlock(
    uint256 _blockHeight,
    bytes32[] memory _proof,
    bytes memory _key,
    bytes memory _value
  ) public view returns (bool) {
    return verifyProof(_proof, blocks[_blockHeight].data.root, hashLeaf(_key, _value));
  }

  function bytesToBytes32Array(
    bytes memory _data,
    uint256 _offset,
    uint256 _items
  ) public pure returns (bytes32[] memory) {
    bytes32[] memory dataList = new bytes32[](_items);

    for (uint256 i = 0; i < _items; i++) {
      bytes32 temp;
      uint256 idx = (i + 1 + _offset) * 32;

      assembly {
        temp := mload(add(_data, idx))
      }

      dataList[i] = temp;
    }

    return (dataList);
  }

  function verifyProofs(
    uint256[] memory _blockHeights,
    bytes memory _proofs,
    uint256[] memory _proofItemsCounter,
    bytes32[] memory _leaves
  ) public view returns (bool[] memory results) {
    results = new bool[](_leaves.length);
    uint256 offset = 0;

    for (uint256 i = 0; i < _leaves.length; i++) {
      results[i] = verifyProof(
        bytesToBytes32Array(_proofs, offset, _proofItemsCounter[i]),
        blocks[_blockHeights[i]].data.root,
        _leaves[i]
      );

      offset += _proofItemsCounter[i];
    }
  }

  function decodeLeafToNumber(bytes memory _leaf) public pure returns (uint) {
    return _leaf.leafToUint();
  }

  function decodeLeafToFloat(bytes memory _leaf) public pure returns (uint) {
    return _leaf.leafTo18DecimalsFloat();
  }

  function verifyProofForBlockForNumber(
    uint256 _blockHeight,
    bytes32[] memory _proof,
    bytes memory _key,
    bytes memory _value
  ) public view returns (bool, uint256) {
    return (verifyProof(_proof, blocks[_blockHeight].data.root, hashLeaf(_key, _value)), _value.leafToUint());
  }

  function verifyProofForBlockForFloat(
    uint256 _blockHeight,
    bytes32[] memory _proof,
    bytes memory _key,
    bytes memory _value
  ) public view returns (bool, uint256) {
    return (
      verifyProof(_proof, blocks[_blockHeight].data.root, hashLeaf(_key, _value)),
      _value.leafTo18DecimalsFloat()
    );
  }

  function getBlockData(uint256 _blockHeight) external view returns (Block memory) {
    return blocks[_blockHeight].data;
  }

  function getBlockRoot(uint256 _blockHeight) external view returns (bytes32) {
    return blocks[_blockHeight].data.root;
  }

  function getBlockMinter(uint256 _blockHeight) external view returns (address) {
    return blocks[_blockHeight].data.minter;
  }

  function getBlockStaked(uint256 _blockHeight) external view returns (uint256) {
    return blocks[_blockHeight].data.staked;
  }

  function getBlockPower(uint256 _blockHeight) external view returns (uint256) {
    return blocks[_blockHeight].data.power;
  }

  function getBlockAnchor(uint256 _blockHeight) external view returns (uint256) {
    return blocks[_blockHeight].data.anchor;
  }

  function getBlockTimestamp(uint256 _blockHeight) external view returns (uint256) {
    return blocks[_blockHeight].data.timestamp;
  }

  function getBlockVotersCount(uint256 _blockHeight) external view returns (uint256) {
    return blocks[_blockHeight].voters.length;
  }

  function getBlockVoters(uint256 _blockHeight) external view returns (address[] memory) {
    return blocks[_blockHeight].voters;
  }

  function getBlockVotes(uint256 _blockHeight, address _voter) external view returns (uint256) {
    return blocks[_blockHeight].votes[_voter];
  }

  function getNumericFCD(uint256 _blockHeight, bytes32 _key) public view returns (uint256 value, uint timestamp) {
    ExtendedBlock storage extendedBlock = blocks[_blockHeight];
    return (extendedBlock.numericFCD[_key], extendedBlock.data.timestamp);
  }

  function getNumericFCDs(
    uint256 _blockHeight, bytes32[] calldata _keys
  ) external view returns (uint256[] memory values, uint256 timestamp) {
    timestamp = blocks[_blockHeight].data.timestamp;
    values = new uint256[](_keys.length);

    for (uint i=0; i<_keys.length; i++) {
      values[i] = blocks[_blockHeight].numericFCD[_keys[i]];
    }
  }

  function getCurrentValue(bytes32 _key) external view returns (uint256 value, uint timestamp) {
    // it will revert when no blocks
    return getNumericFCD(getLatestBlockHeightWithData(), _key);
  }

  // ========== EVENTS ========== //

  event LogMint(address indexed minter, uint256 blockHeight, uint256 anchor);
  event LogBlockPadding(address indexed executor, uint256 blockPadding);
}
