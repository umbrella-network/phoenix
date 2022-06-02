// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
//pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@umb-network/toolbox/dist/contracts/lib/ValueDecoder.sol";

import "./interfaces/IStakingBank.sol";

import "./BaseChain.sol";

/// @dev contract for homechain
contract Chain is BaseChain {
    using MerkleProof for bytes32;

    IStakingBank public immutable stakingBank;

    event LogMint(address indexed minter, uint256 blockId, uint256 staked, uint256 power);
    event LogVoter(uint256 indexed blockId, address indexed voter, uint256 vote);

    error SignaturesOutOfOrder();
    error NotEnoughSignatures();

    /// @param _contractRegistry Registry address
    /// @param _padding required "space" between blocks in seconds
    /// @param _requiredSignatures number of required signatures for accepting consensus submission
    constructor(
        IRegistry _contractRegistry,
        uint16 _padding,
        uint16 _requiredSignatures
    ) BaseChain(_contractRegistry, _padding, _requiredSignatures) {
        stakingBank = IStakingBank(_contractRegistry.requireAndGetAddress("StakingBank"));
    }

    /// @inheritdoc BaseChain
    function isForeign() external pure override returns (bool) {
        return false;
    }

    /// @inheritdoc Registrable
    function getName() external pure override returns (bytes32) {
        return "Chain";
    }

    /// @dev helper method that returns all important data about current state of contract
    /// @return blockNumber `block.number`
    /// @return timePadding `this.padding`
    /// @return lastDataTimestamp timestamp for last submitted consensus
    /// @return lastBlockId ID of last submitted consensus
    /// @return nextLeader leader for `block.timestamp + 1`
    /// @return nextBlockId block ID for `block.timestamp + 1`
    /// @return validators array of all validators addresses
    /// @return powers array of all validators powers
    /// @return locations array of all validators locations
    /// @return staked total UMB staked by validators
    /// @return minSignatures `this.requiredSignatures`
    function getStatus() external view returns(
        uint256 blockNumber,
        uint16 timePadding,
        uint32 lastDataTimestamp,
        uint32 lastBlockId,
        address nextLeader,
        uint32 nextBlockId,
        address[] memory validators,
        uint256[] memory powers,
        string[] memory locations,
        uint256 staked,
        uint16 minSignatures
    ) {
        blockNumber = block.number;
        timePadding = padding;
        lastBlockId = getLatestBlockId();
        lastDataTimestamp = squashedRoots[lastBlockId].extractTimestamp();
        minSignatures = requiredSignatures;

        staked = stakingBank.totalSupply();
        uint256 numberOfValidators = stakingBank.getNumberOfValidators();
        powers = new uint256[](numberOfValidators);
        validators = new address[](numberOfValidators);
        locations = new string[](numberOfValidators);

        for (uint256 i = 0; i < numberOfValidators;) {
            validators[i] = stakingBank.addresses(i);
            (, locations[i]) = stakingBank.validators(validators[i]);
            powers[i] = stakingBank.balanceOf(validators[i]);

            unchecked {
                i++;
            }
        }

        unchecked {
            // we will not overflow with timestamp
            nextBlockId = getBlockIdAtTimestamp(block.timestamp + 1);

            nextLeader = numberOfValidators > 0
                // we will not overflow with timestamp
                ? validators[getLeaderIndex(numberOfValidators, block.timestamp + 1)]
                : address(0);
        }
    }

    /// @return address of leader for next second
    function getNextLeaderAddress() external view returns (address) {
        return getLeaderAddressAtTime(block.timestamp + 1);
    }

    /// @return address of current leader
    function getLeaderAddress() external view returns (address) {
        return getLeaderAddressAtTime(block.timestamp);
    }

    /// @dev method for submitting consensus data
    /// @param _dataTimestamp consensus timestamp, this is time for all data in merkle tree including FCDs
    /// @param _root merkle root
    /// @param _keys FCDs keys
    /// @param _values FCDs values
    /// @param _v array of `v` part of validators signatures
    /// @param _r array of `r` part of validators signatures
    /// @param _s array of `s` part of validators signatures
    // solhint-disable-next-line function-max-lines, code-complexity
    function submit(
        uint32 _dataTimestamp,
        bytes32 _root,
        bytes32[] memory _keys,
        uint256[] memory _values,
        uint8[] memory _v,
        bytes32[] memory _r,
        bytes32[] memory _s
    ) public { // it could be external, but for external we got stack too deep
        uint32 lastBlockId = getLatestBlockId();
        uint32 lastDataTimestamp = squashedRoots[lastBlockId].extractTimestamp();

        unchecked {
            // we will not overflow with timestamp and padding(uint16)
            if (lastDataTimestamp + padding >= block.timestamp) revert BlockSubmittedToFast();
        }

        if (_dataTimestamp <= lastDataTimestamp) revert DataToOld();
        // we can't expect minter will have exactly the same timestamp
        // but for sure we can demand not to be off by a lot, that's why +3sec
        // temporary remove this condition, because recently on ropsten we see cases when minter/node
        // can be even 100sec behind
        // require(_dataTimestamp <= block.timestamp + 3,
        //   string(abi.encodePacked("oh, so you can predict the future:", _dataTimestamp - block.timestamp + 48)));
        if (_keys.length != _values.length) revert ArraysDataDoNotMatch();

        bytes memory testimony = abi.encodePacked(_dataTimestamp, _root);

        for (uint256 i = 0; i < _keys.length;) {
            if (uint224(_values[i]) != _values[i]) revert FCDOverflow();

            fcds[_keys[i]] = FirstClassData(uint224(_values[i]), _dataTimestamp);
            testimony = abi.encodePacked(testimony, _keys[i], _values[i]);

            unchecked {
                i++;
            }
        }

        bytes32 affidavit = keccak256(testimony);
        uint256 power = 0;

        uint256 staked = stakingBank.totalSupply();
        address prevSigner = address(0x0);

        uint256 signatures = 0;

        for (uint256 i; i < _v.length;) {
            address signer = recoverSigner(affidavit, _v[i], _r[i], _s[i]);
            uint256 balance = stakingBank.balanceOf(signer);

            if (prevSigner >= signer) revert SignaturesOutOfOrder();

            prevSigner = signer;

            if (balance == 0) {
                unchecked {
                    i++;
                }

                continue;
            }

            signatures++;

            unchecked {
                emit LogVoter(lastBlockId + 1, signer, balance);
                power += balance; // no need for safe math, if we overflow then we will not have enough power
                i++;
            }
        }

        if (signatures < requiredSignatures) revert NotEnoughSignatures();
        // we turn on power once we have proper DPoS
        // require(power * 100 / staked >= 66, "not enough power was gathered");

        unchecked {
            // we will not overflow on `lastBlockId + 1` in a life time
            squashedRoots[lastBlockId + 1] = _root.makeSquashedRoot(_dataTimestamp);
            blocksCount++;

            emit LogMint(msg.sender, lastBlockId + 1, staked, power);
        }
    }

    /// @param _numberOfValidators total number of validators
    /// @param _timestamp timestamp for which you want to calculate index
    /// @return leader index, use it for StakingBank.addresses[index] to fetch leader address
    function getLeaderIndex(uint256 _numberOfValidators, uint256 _timestamp) public view returns (uint256) {
        uint32 latestBlockId = getLatestBlockId();

        unchecked {
            // we will not overflow on `timestamp` and `padding` in a life time
            // timePadding + 1 => because padding is a space between blocks, so next round starts on first block after padding
            uint256 validatorIndex = latestBlockId +
            (_timestamp - squashedRoots[latestBlockId].extractTimestamp()) / (padding + 1);

            return uint16(validatorIndex % _numberOfValidators);
        }
    }

    // @todo - properly handled non-enabled validators, newly added validators, and validators with low stake
    /// @param _timestamp timestamp for which you want to calculate leader address
    /// @return leader address for provider timestamp
    function getLeaderAddressAtTime(uint256 _timestamp) public view returns (address) {
        uint256 numberOfValidators = stakingBank.getNumberOfValidators();

        if (numberOfValidators == 0) {
            return address(0x0);
        }

        uint256 validatorIndex = getLeaderIndex(numberOfValidators, _timestamp);

        return stakingBank.addresses(validatorIndex);
    }
}
