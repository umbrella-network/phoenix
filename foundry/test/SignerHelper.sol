pragma solidity ^0.8.0;

import "ds-test/test.sol";

import "../lib/CheatCodes.sol";
import "../lib/Mock.sol";

import "../../contracts/onChainFeeds/UmbrellaFeeds.sol";
import "../../contracts/StakingBankState.sol";
import "../../contracts/stakingBankStatic/StakingBankStatic.sol";
import "../../contracts/stakingBankStatic/StakingBankStaticCI.sol";


contract SignerHelper is DSTest {
    uint256 constant PK1 = 0x87630b2d1de0fbd5044eb6891b3d9d98c34c8d310c852f98550ba774480e47cc;
    uint256 constant PK2 = 0x3f1e8b94c70206bf816c1ed0b15ad98bdf225ae4c6e7e4eee6cdbcf706fda2ae;
    uint256 constant PK3 = 0x5da6b84117504d06b5dcd52b990d76965d2882f4e5852eb610bc76e4209b10d7;
    uint256 constant PK4 = 0x1e5012671de3332ad0b43661984e94ab0e405bffddc9d3e863055040bab354b8;
    uint256 constant PK5 = 0x0edc1e35ea7701ddac703286674e79f04addbf5d2f6162fabc19d39bd3dc6662;
    uint256 constant PK6 = 0x23c601ae397441f3ef6f1075dcb0031ff17fb079837beadaf3c84d96c6f3e569;
    uint256 constant PK_INVALID = uint256(0x11); // 0x252Dae0A4b9d9b80F504F6418acd2d364C0c59cD

    IStakingBank public immutable bank;

    CheatCodes constant cheats = CheatCodes(HEVM_ADDRESS);

    constructor() {
        bank = new StakingBankStaticCI(6);
    }

    function _pk(uint256 _i) internal pure returns (uint256) {
        if (_i == 0) return PK1;
        if (_i == 1) return PK2;
        if (_i == 2) return PK3;
        if (_i == 3) return PK4;
        if (_i == 4) return PK5;
        if (_i == 5) return PK6;
        return PK_INVALID;
    }

    function _signData(
        uint256 _numSigs,
        UmbrellaFeeds _feeds,
        bytes32[] memory _priceKeys,
        IUmbrellaFeeds.PriceData[] memory _priceDatas
    ) internal returns (IUmbrellaFeeds.Signature[] memory signatures) {
        bytes32 priceDataHash = keccak256(abi.encode(_feeds.getChainId(), address(_feeds), _priceKeys, _priceDatas));
        bytes32 hash = keccak256(abi.encodePacked(_feeds.ETH_PREFIX(), priceDataHash));

        signatures = new UmbrellaFeeds.Signature[](_numSigs);

        for (uint256 i; i < _numSigs; i++) {
            (signatures[i].v, signatures[i].r, signatures[i].s) = cheats.sign(_pk(i), hash);
        }
    }

    function _invalidSignData(
        uint256 _numSigs,
        UmbrellaFeeds _feeds,
        bytes32[] memory _priceKeys,
        IUmbrellaFeeds.PriceData[] memory _priceDatas
    ) internal returns (IUmbrellaFeeds.Signature[] memory signatures) {
        bytes32 priceDataHash = keccak256(abi.encode(_feeds.getChainId(), address(_feeds), _priceKeys, _priceDatas));
        bytes32 hash = keccak256(abi.encodePacked(_feeds.ETH_PREFIX(), priceDataHash));

        signatures = new UmbrellaFeeds.Signature[](_numSigs);

        for (uint256 i; i < _numSigs; i++) {
            (signatures[i].v, signatures[i].r, signatures[i].s) =
                i == 0 ? cheats.sign(_pk(999), hash) : cheats.sign(_pk(i), hash);
        }
    }

    function _signReset(
        uint256 _numSigs,
        UmbrellaFeeds _feeds,
        bytes32[] memory _priceKeys
    ) internal returns (IUmbrellaFeeds.Signature[] memory signatures) {
        bytes32 resetHash = keccak256(abi.encodePacked(_feeds.getChainId(), address(_feeds), _priceKeys, "RESET"));
        bytes32 hash = keccak256(abi.encodePacked(_feeds.ETH_PREFIX(), resetHash));

        signatures = new UmbrellaFeeds.Signature[](_numSigs);

        for (uint256 i; i < _numSigs; i++) {
            (signatures[i].v, signatures[i].r, signatures[i].s) = cheats.sign(_pk(i), hash);
        }
    }
}
