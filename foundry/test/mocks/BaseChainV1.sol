pragma solidity ^0.8.0;

import "contracts/interfaces/IBaseChainV1.sol";

// I wasn't able to mock this call:
// IBaseChainV1(address(oldChain)).getBlockTimestamp(latestId);
// because of this error:
// Message:  range end index 36 out of range for slice of length 32
// so I have to create real contract

contract BaseChainV1 is IBaseChainV1 {
    bool public deprecated;
    uint32 public blockTimestamp;
    uint32 public override blocksCount;
    uint32 public immutable override blocksCountOffset;

    constructor (uint32 _blocksCountOffset) {
        blocksCountOffset = _blocksCountOffset;
    }

    function getName() external pure returns (bytes32) {
        return "Chain";
    }

    function unregister() external {
        if (deprecated) revert();
        // this is not part of V1, but for old registry it will not be called
        // for new registry (the one that we are testing with) we need this method
        deprecated = true;
    }

    function setData(uint32 _blockTimestamp, uint32 _blocksCount) external {
        blockTimestamp = _blockTimestamp;
        blocksCount = _blocksCount;
    }

    function getLatestBlockId() external view returns (uint32) {
        return blocksCount + blocksCountOffset - 1;
    }

    function getBlockTimestamp(uint32 _blockId) external view returns (uint32) {
        return blockTimestamp;
    }

    function getStatus() external view returns (
        uint256 blockNumber,
        uint16 timePadding,
        uint32 lastDataTimestamp,
        uint32 lastId,
        uint32 nextBlockId
    ) {
        revert("not in use");
    }
}
