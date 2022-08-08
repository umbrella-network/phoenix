pragma solidity ^0.8.0;

import "ds-test/test.sol";

import "../../contracts/Registry.sol";
import "../../contracts/Chain.sol";
import "../../contracts/StakingBank.sol";
import "../lib/CheatCodes.sol";
import "../lib/Mock.sol";
import "./mocks/BaseChainV1.sol";

// I wasn't able to mock this call:
// IBaseChainV1(address(oldChain)).getBlockTimestamp(latestId);
// because of this error:
// Message:  range end index 36 out of range for slice of length 32
// so I have to create real contract

contract ChainV1UpdateTest is DSTest {
    Registry public registry;

    BaseChainV1 public chainV1;
    address public stakingBank;
    Chain public newChain;

    CheatCodes constant cheats = CheatCodes(HEVM_ADDRESS);

    modifier ensureSuccessfulUpdate() {
        uint32 padding = 123;
        newChain = new Chain(registry, padding, 1, false);

        uint32 _blockTimestamp = 222;
        uint32 _blocksCount = 333;

        chainV1.setData(_blockTimestamp, _blocksCount);

        // updating/redeploying
        _;

        assertTrue(chainV1.deprecated(), "chainV1.deprecated()");
        assertEq(newChain.blocksCountOffset(), chainV1.blocksCount() + 2, "invalid .blocksCountOffset()");
        assertEq(newChain.requiredSignatures(), 1, "invalid requiredSignatures()");

        Chain.ConsensusData memory data = newChain.getConsensusData();
        assertEq(data.sequence, _blocksCount + chainV1.blocksCountOffset() + 1, "unexpected data.sequence");
        assertEq(data.lastTimestamp, _blockTimestamp, "unexpected data.lastTimestamp");
        assertEq(data.padding, padding, "unexpected data.padding");
        assertTrue(!data.deprecated, "!data.deprecated");

        assertTrue(address(newChain) == registry.getAddress(bytes32("Chain")));

        _doSubmit(newChain);

        Chain chainV2 = new Chain(registry, padding, 1, false);
        assertEq(chainV2.requiredSignatures(), 1);

        // second time we can call atomic
        registry.atomicUpdate(address(chainV2));

        Chain.ConsensusData memory oldData = newChain.getConsensusData();
        assertTrue(oldData.deprecated);

        assertEq(chainV2.blocksCountOffset(), oldData.sequence, "chainV2.blocksCountOffset() vs oldData.sequence");

        Chain.ConsensusData memory dataV2 = chainV2.getConsensusData();

        assertEq(dataV2.sequence, oldData.sequence, "invalid .sequence");
        assertEq(dataV2.lastTimestamp, oldData.lastTimestamp, "invalid .lastTimestamp");
        assertEq(dataV2.padding, padding, "invalid padding");
        assertTrue(!dataV2.deprecated, "!dataV2.deprecated");
    }

    function setUp() public {
        registry = new Registry();
        address[] memory addresses = new address[](1);

        stakingBank = Mock.create("IStakingBank");
        addresses[0] = stakingBank;
        cheats.mockCall(stakingBank, abi.encodeCall(StakingBank.getName, ()), abi.encode(bytes32("StakingBank")));
        registry.importContracts(addresses);

        chainV1 = new BaseChainV1(1);

        addresses[0] = address(chainV1);
        registry.importContracts(addresses);
    }

    function test_chainAtomicUpdate() public ensureSuccessfulUpdate {
        registry.atomicUpdate(address(newChain));
    }

    /// @dev when we wil be using Mutisig, this is the way to update:
    /// - create 3 tx: register,
    function test_chainManualUpdate() public ensureSuccessfulUpdate {
        newChain.register();
        address[] memory a = new address[](1);
        a[0] = address(newChain);

        registry.importContracts(a);
        chainV1.unregister();
    }

    function _doSubmit(Chain _chain) internal {
        bytes32[] memory r = new bytes32[](1);
        bytes32[] memory s = new bytes32[](1);
        uint8[] memory v = new uint8[](1);

        bytes32[] memory emptyKeys = new bytes32[](0);
        uint256[] memory emptyValues = new uint256[](0);

        r[0] = bytes32(0x6776ae65276cd06989031ed0104746f2f6762ae20d54c9867e139ff8440cecad);
        s[0] = bytes32(0x409feb1c5de58b25c6e8d1415f46921a359f6d9e4e069c0c79608b210c7af1cf);
        v[0] = 28;

        uint32 dataTimestamp = 1655306190;
        bytes32 root = bytes32(0x16611e5952b4bbeb55b1ae2f2aeeae0497941f133425f15344a4be3c82b3d992);
        address validator = address(0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4);

        cheats.mockCall(stakingBank, abi.encodeCall(IERC20.balanceOf, (validator)), abi.encode(100));
        cheats.mockCall(stakingBank, abi.encodeCall(IERC20.totalSupply, ()), abi.encode(100));

        cheats.prank(validator);
        _chain.submit(dataTimestamp, root, emptyKeys, emptyValues, v, r, s);
    }
}
