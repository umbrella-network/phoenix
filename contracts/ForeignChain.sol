// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "./Registry.sol";
import "./BaseChain.sol";

/// @dev contract for foreign-chains
contract ForeignChain is BaseChain {
    using MerkleProof for bytes32;

    /// @dev replicator is the one who can replicate consensus from home-chain to this contract
    address public immutable replicator;

    event LogBlockReplication(address indexed minter, uint32 blockId);

    error OnlyReplicator();
    error ContractDeprecated();
    error DuplicatedBlockId();
    error IDConflict();

    /// @param _contractRegistry Registry address
    /// @param _padding required "space" between blocks in seconds
    /// @param _requiredSignatures this is only for compatibility
    /// @param _replicator address of wallet that is allow to do submit
    constructor(
        IRegistry _contractRegistry,
        uint32 _padding,
        uint16 _requiredSignatures,
        address _replicator,
        bool _allowForMixedType
    ) BaseChain(_contractRegistry, _padding, _requiredSignatures, _allowForMixedType) {
        replicator = _replicator;
    }

    modifier onlyReplicator() {
        if (msg.sender != replicator) revert OnlyReplicator();
        _;
    }

    /// @dev method for submitting/replicating consensus data
    /// @param _dataTimestamp consensus timestamp, this is time for all data in merkle tree including FCDs
    /// @param _root merkle root
    /// @param _keys FCDs keys
    /// @param _values FCDs values
    /// @param _blockId consensus ID from homechain, it must be equal to `_dataTimestamp`
    /// this parameter can be remove in a future, it is kept for backward compatibility
    // solhint-disable-next-line code-complexity
    function submit(
        uint32 _dataTimestamp,
        bytes32 _root,
        bytes32[] calldata _keys,
        uint256[] calldata _values,
        uint32 _blockId
    ) external onlyReplicator {
        ConsensusData memory data = _consensusData;

        if (_dataTimestamp != _blockId) revert IDConflict();
        if (data.deprecated) revert ContractDeprecated();
        if (roots[_blockId] != bytes32(0)) revert DuplicatedBlockId();
        if (_dataTimestamp <= data.lastTimestamp) revert DataToOld();

        unchecked {
            // we will not overflow on `timestamp` and `padding` in a life time
            if (data.lastTimestamp + data.padding >= block.timestamp) revert BlockSubmittedToFast();
        }

        if (_keys.length != _values.length) revert ArraysDataDoNotMatch();

        for (uint256 i = 0; i < _keys.length;) {
            if (uint224(_values[i]) != _values[i]) revert FCDOverflow();

            fcds[_keys[i]] = FirstClassData(uint224(_values[i]), _dataTimestamp);

            unchecked {
                i++;
            }
        }

        roots[_blockId] = _root;
        _consensusData.lastTimestamp = _dataTimestamp;

        unchecked {
            // we will not overflow in a lifetime
            _consensusData.sequence = data.sequence + 1;
        }

        emit LogBlockReplication(msg.sender, _blockId);
    }

    /// @inheritdoc BaseChain
    function isForeign() external pure override returns (bool) {
        return true;
    }

    /// @dev helper method that returns all important data about current state of contract
    /// @return blockNumber `block.number`
    /// @return timePadding `consensusData.padding`
    /// @return lastDataTimestamp timestamp for last submitted consensus
    /// @return lastId ID same as `lastDataTimestamp` because ID is timestamp
    /// @return nextBlockId block ID for `block.timestamp + 1`
    function getStatus() external view returns(
        uint256 blockNumber,
        uint32 timePadding,
        uint32 lastDataTimestamp,
        uint32 lastId,
        uint32 nextBlockId
    ) {
        blockNumber = block.number;
        timePadding = _consensusData.padding;
        lastId = _consensusData.lastTimestamp;
        lastDataTimestamp = lastId;

        unchecked {
            // we will not overflow on `timestamp` in a life time
            nextBlockId = getBlockIdAtTimestamp(block.timestamp + 1);
        }
    }
}
