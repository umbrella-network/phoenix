// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "./Registry.sol";
import "./BaseChain.sol";

/// @dev contract for foreign-chains
contract ForeignChain is BaseChain {
    using MerkleProof for bytes32;

    /// @dev replicator is the one who can replicate consensus from home-chain to this contract
    address public immutable replicator;

    /// @dev last submitted consensus ID
    uint32 public lastBlockId;

    /// @dev flag that lets, if this contract was replaced by newer one
    /// if TRUE, block submission is not longer available
    bool public deprecated;

    event LogBlockReplication(address indexed minter, uint32 blockId);
    event LogDeprecation(address indexed deprecator);

    error OnlyReplicator();
    error OnlyContractRegistryCanRegister();
    error AlreadyRegistered();
    error AlreadyDeprecated();
    error UnregisterFirst();
    error InvalidContractType();
    error ContractDeprecated();
    error DuplicatedBlockId();

    /// @param _contractRegistry Registry address
    /// @param _padding required "space" between blocks in seconds
    /// @param _requiredSignatures this is only for compatibility
    /// @param _replicator address of wallet that is allow to do submit
    constructor(
        IRegistry _contractRegistry,
        uint16 _padding,
        uint16 _requiredSignatures,
        address _replicator
    ) BaseChain(_contractRegistry, _padding, _requiredSignatures) {
        replicator = _replicator;
    }

    modifier onlyReplicator() {
        if (msg.sender != replicator) revert OnlyReplicator();
        _;
    }

    /// @inheritdoc Registrable
    function register() external override {
        if (msg.sender != address(contractRegistry)) revert OnlyContractRegistryCanRegister();

        ForeignChain oldChain = ForeignChain(contractRegistry.getAddress("Chain"));
        // registration must be done before address in registry is replaced
        if (address(oldChain) == address(this)) revert AlreadyRegistered();

        if (address(oldChain) != address(0x0)) {
            lastBlockId = oldChain.lastBlockId();
            // we cloning last block time, because we will need reference point for next submissions

            // TODO remove this after first redeployment will be done
            //      we need two deployment to switch from blocks -> squashedRoots because previous version and this one
            //      are not compatible in a sense of registering/unregistering
            //      on release we will deploy contract with step1) then we can delete step1) completely
            //      later deployment can be done normally, using step2
            // step 1) first update
            uint32 lastBlockTime = oldChain.blocks(lastBlockId).dataTimestamp;
            bytes32 lastRootTime;

            // solhint-disable-next-line no-inline-assembly
            assembly {
                lastRootTime := or(0x0, lastBlockTime)
            }

            squashedRoots[lastBlockId] = lastRootTime;

            // step 2) next updates (we can remove step1)
            // squashedRoots[lastBlockId] = oldChain.squashedRoots(lastBlockId);
        }
    }

    /// @inheritdoc Registrable
    function unregister() external override {
        if (msg.sender != address(contractRegistry)) revert OnlyContractRegistryCanRegister();
        if (deprecated) revert AlreadyDeprecated();

        ForeignChain newChain = ForeignChain(contractRegistry.getAddress("Chain"));
        // unregistering must be done after address in registry is replaced
        if (address(newChain) == address(this)) revert UnregisterFirst();
        // can not be replaced with chain of different type
        if (!newChain.isForeign()) revert InvalidContractType();

        deprecated = true;
        emit LogDeprecation(msg.sender);
    }

    /// @dev method for submitting/replicating consensus data
    /// @param _dataTimestamp consensus timestamp, this is time for all data in merkle tree including FCDs
    /// @param _root merkle root
    /// @param _keys FCDs keys
    /// @param _values FCDs values
    /// @param _blockId consensus ID from homechain
    // solhint-disable-next-line code-complexity
    function submit(
        uint32 _dataTimestamp,
        bytes32 _root,
        bytes32[] calldata _keys,
        uint256[] calldata _values,
        uint32 _blockId
    ) external onlyReplicator {
        if (deprecated) revert ContractDeprecated();

        uint lastDataTimestamp = squashedRoots[lastBlockId].extractTimestamp();

        if (squashedRoots[_blockId].extractTimestamp() != 0) revert DuplicatedBlockId();
        if (_dataTimestamp <= lastDataTimestamp) revert DataToOld();

        unchecked {
            // we will not overflow on `timestamp` and `padding` in a life time
            if (lastDataTimestamp + padding >= block.timestamp) revert BlockSubmittedToFast();
        }

        if (_keys.length != _values.length) revert ArraysDataDoNotMatch();

        for (uint256 i = 0; i < _keys.length;) {
            if (uint224(_values[i]) != _values[i]) revert FCDOverflow();

            fcds[_keys[i]] = FirstClassData(uint224(_values[i]), _dataTimestamp);

            unchecked {
                i++;
            }
        }

        squashedRoots[_blockId] = MerkleProof.makeSquashedRoot(_root, _dataTimestamp);
        lastBlockId = _blockId;

        emit LogBlockReplication(msg.sender, _blockId);
    }

    /// @inheritdoc BaseChain
    function isForeign() external pure override returns (bool) {
        return true;
    }

    /// @inheritdoc Registrable
    function getName() external pure override returns (bytes32) {
        return "Chain";
    }

    /// @dev helper method that returns all important data about current state of contract
    /// @return blockNumber `block.number`
    /// @return timePadding `this.padding`
    /// @return lastDataTimestamp timestamp for last submitted consensus
    /// @return lastId ID of last submitted consensus
    /// @return nextBlockId block ID for `block.timestamp + 1`
    function getStatus() external view returns(
        uint256 blockNumber,
        uint16 timePadding,
        uint32 lastDataTimestamp,
        uint32 lastId,
        uint32 nextBlockId
    ) {
        blockNumber = block.number;
        timePadding = padding;
        lastId = lastBlockId;
        lastDataTimestamp = squashedRoots[lastId].extractTimestamp();

        unchecked {
            // we will not overflow on `timestamp` in a life time
            nextBlockId = getBlockIdAtTimestamp(block.timestamp + 1);
        }
    }

    // this function does not works for past timestamps
    function getBlockIdAtTimestamp(uint256 _timestamp) public view override returns (uint32) {
        uint32 lastId = lastBlockId;
        uint32 dataTimestamp = squashedRoots[lastId].extractTimestamp();

        if (dataTimestamp == 0) {
            return 0;
        }

        unchecked {
            // we will not overflow on `timestamp` and `padding` in a life time
            if (dataTimestamp + padding < _timestamp) {
                return lastId + 1;
            }
        }

        return lastId;
    }

    /// @inheritdoc BaseChain
    function getLatestBlockId() public view override returns (uint32) {
        return lastBlockId;
    }
}
