pragma solidity ^0.8.0;

import "ds-test/test.sol";

import "../lib/CheatCodes.sol";
import "../lib/Mock.sol";

import "../../contracts/onChainFeeds/UmbrellaFeeds.sol";
import "../../contracts/StakingBankState.sol";


contract SignerHelper is DSTest {
    // 0x2ffd013aaa7b5a7da93336c2251075202b33fb2b
    uint256 constant PK1 = 0x87630b2d1de0fbd5044eb6891b3d9d98c34c8d310c852f98550ba774480e47cc;
    // 0xe5904695748fe4a84b40b3fc79de2277660bd1d3
    uint256 constant PK2 = 0x23c601ae397441f3ef6f1075dcb0031ff17fb079837beadaf3c84d96c6f3e569;

    address public immutable bank;

    CheatCodes constant cheats = CheatCodes(HEVM_ADDRESS);

    constructor() {
        bank = Mock.create("StakingBank");
    }

    function _signData(
        UmbrellaFeeds _feeds,
        bytes32[] memory _priceKeys,
        IUmbrellaFeeds.PriceData[] memory _priceDatas
    ) internal returns (IUmbrellaFeeds.Signature[] memory signatures) {
        bytes32 priceDataHash = keccak256(abi.encode(_feeds.getChainId(), address(_feeds), _priceKeys, _priceDatas));
        bytes32 hash = keccak256(abi.encodePacked(_feeds.ETH_PREFIX(), priceDataHash));

        signatures = new UmbrellaFeeds.Signature[](2);
        (signatures[0].v, signatures[0].r, signatures[0].s) = cheats.sign(PK1, hash);
        (signatures[1].v, signatures[1].r, signatures[1].s) = cheats.sign(PK2, hash);

        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (cheats.addr(PK1))), abi.encode(uint256(1e18)));
        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (cheats.addr(PK2))), abi.encode(uint256(1e18)));
    }

    function _signReset(
        UmbrellaFeeds _feeds,
        bytes32[] memory _priceKeys
    ) internal returns (IUmbrellaFeeds.Signature[] memory signatures) {
        bytes32 resetHash = keccak256(abi.encodePacked(_feeds.getChainId(), address(_feeds), _priceKeys, "RESET"));
        bytes32 hash = keccak256(abi.encodePacked(_feeds.ETH_PREFIX(), resetHash));

        signatures = new UmbrellaFeeds.Signature[](2);
        (signatures[0].v, signatures[0].r, signatures[0].s) = cheats.sign(PK1, hash);
        (signatures[1].v, signatures[1].r, signatures[1].s) = cheats.sign(PK2, hash);

        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (cheats.addr(PK1))), abi.encode(uint256(1e18)));
        cheats.mockCall(bank, abi.encodeCall(StakingBankState.balanceOf, (cheats.addr(PK2))), abi.encode(uint256(1e18)));
    }
}
