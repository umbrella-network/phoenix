// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "../interfaces/IUmbrellaFeeds.sol";
import "../interfaces/IRegistry.sol";
import "../interfaces/IStakingBank.sol";

/// @dev Main contract for all deviation triggered fees.
/// This contract has build in fallback feature in case it will be replaced by newer version.
/// Fallback is transparent for the user, no additional setup is needed.
///
/// How fallback feature works? If data for provided key is empty, contract will execute following procedure:
/// 1. triggered feeds, that needs to be updated will be updated in new contract and erased from this one
/// 2. if data is empty, check, if new deployment of UmbrellaFeeds is done, if not stop.
/// 3. forward the call to that new contract.
///
/// After new deployment done it is recommended to update address to avoid fallback and reduce gas cost.
/// In long run this is most efficient solution, better than any proxy.
contract UmbrellaFeeds is IUmbrellaFeeds {
    bytes constant public ETH_PREFIX = "\x19Ethereum Signed Message:\n32";
    string constant public NAME = "UmbrellaFeeds";

    IStakingBank public immutable STAKING_BANK;  // solhint-disable-line var-name-mixedcase
    IRegistry public immutable REGISTRY;  // solhint-disable-line var-name-mixedcase

    /// @dev minimal number of signatures required for accepting submission (PoA)
    uint16 public immutable REQUIRED_SIGNATURES; // solhint-disable-line var-name-mixedcase

    /// @dev decimals for prices stored in this contract
    uint8 public immutable DECIMALS;  // solhint-disable-line var-name-mixedcase

    mapping (bytes32 => PriceData) public prices;

    error ArraysDataDoNotMatch();
    error FeedNotExist();
    error FallbackFeedNotExist();
    error NotEnoughSignatures();
    error InvalidRequiredSignatures();
    error SignaturesOutOfOrder();
    error OldData();

    /// @param _contractRegistry Registry address
    /// @param _requiredSignatures number of required signatures for accepting consensus submission
    /// @param _decimals decimals for prices stored in this contract
    constructor(
        IRegistry _contractRegistry,
        uint16 _requiredSignatures,
        uint8 _decimals
    ) {
        if (_requiredSignatures == 0) revert InvalidRequiredSignatures();

        REGISTRY = _contractRegistry;
        REQUIRED_SIGNATURES = _requiredSignatures;
        STAKING_BANK = IStakingBank(_contractRegistry.requireAndGetAddress("StakingBank"));
        DECIMALS = _decimals;
    }

    /// @inheritdoc IUmbrellaFeeds
    function update(
        bytes32[] calldata _priceKeys,
        PriceData[] calldata _priceDatas,
        Signature[] calldata _signatures
    ) external {
        // below two checks are only for pretty errors, so we can safe gas and allow for raw revert
        // if (_priceKeys.length != _priceDatas.length) revert ArraysDataDoNotMatch();

        bytes32 priceDataHash = keccak256(abi.encode(_priceKeys, _priceDatas));
        verifySignatures(priceDataHash, _signatures);

        uint256 i;

        while (i < _priceDatas.length) {
            // we do not allow for older prices
            // at the same time it prevents from reusing signatures
            if (prices[_priceKeys[i]].timestamp >= _priceDatas[i].timestamp) revert OldData();

            prices[_priceKeys[i]] = _priceDatas[i];

            // atm there is no need for events, so in order to save gas, we do not emit any
            unchecked { i++; }
        }
    }

    /// @inheritdoc IUmbrellaFeeds
    function reset(bytes32[] calldata _priceKeys, Signature[] calldata _signatures) external {
        bytes32 resetHash = keccak256(abi.encodePacked(_priceKeys, "RESET"));
        verifySignatures(resetHash, _signatures);

        for (uint256 i; i < _priceKeys.length;) {
            delete prices[_priceKeys[i]];
            // atm there is no need for events, so in order to save gas, we do not emit any
            unchecked { i++; }
        }
    }

    /// @dev method for submitting consensus data
    /// @param _hash hash of signed data
    /// @param _signatures array of validators signatures
    // ss solhint-disable-next-line function-max-lines, code-complexity
    function verifySignatures(bytes32 _hash, Signature[] calldata _signatures) public view {
        address prevSigner = address(0x0);

        if (_signatures.length < REQUIRED_SIGNATURES) revert NotEnoughSignatures();

        // to save gas we check only required number of signatures
        // case, where you can have part of signatures invalid but still enough valid in total is not supported
        for (uint256 i; i < REQUIRED_SIGNATURES;) {
            address signer = recoverSigner(_hash, _signatures[i].v, _signatures[i].r, _signatures[i].s);
            if (prevSigner >= signer) revert SignaturesOutOfOrder();

            // because we check only required number of signatures, any invalid one will cause revert
            if (STAKING_BANK.balanceOf(signer) == 0) revert NotEnoughSignatures();

            prevSigner = signer;

            unchecked { i++; }
        }
    }

    /// @param _hash hashed of data
    /// @param _v part of signature
    /// @param _r part of signature
    /// @param _s part of signature
    /// @return signer address
    function recoverSigner(bytes32 _hash, uint8 _v, bytes32 _r, bytes32 _s) public pure returns (address) {
        bytes32 hash = keccak256(abi.encodePacked(ETH_PREFIX, _hash));
        return ecrecover(hash, _v, _r, _s);
    }

    /// @dev helper method for QA purposes
    /// @return hash of data that are signed by validators (keys and priced data)
    function hashSubmitData(bytes32[] calldata _priceKeys, PriceData[] calldata _priceDatas)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(_priceKeys, _priceDatas));
    }

    /// @inheritdoc IUmbrellaFeeds
    function getPricesData(bytes32[] calldata _keys) external view returns (PriceData[] memory data) {
        data = new PriceData[](_keys.length);

        for (uint256 i; i < _keys.length;) {
            data[i] = prices[_keys[i]];

            if (data[i].timestamp == 0) {
                data[i] = _fallbackCall(_keys[i]);
            }

            unchecked { i++; }
        }
    }

    /// @inheritdoc IUmbrellaFeeds
    function getPricesDataRaw(bytes32[] calldata _keys) external view returns (PriceData[] memory data) {
        data = new PriceData[](_keys.length);

        for (uint256 i; i < _keys.length;) {
            data[i] = prices[_keys[i]];

            if (data[i].timestamp == 0) {
                data[i] = _fallbackCallRaw(_keys[i]);
            }

            unchecked { i++; }
        }
    }

    /// @dev this is only for dev debug,
    /// please use `getPriceData` directly for lower has cost and fallback functionality
    function priceData(string memory _key) external view returns (PriceData memory) {
        return prices[keccak256(abi.encodePacked(_key))];
    }

    /// @inheritdoc IUmbrellaFeeds
    function getPriceData(bytes32 _key) external view returns (PriceData memory data) {
        data = prices[_key];

        if (data.timestamp == 0) {
            data = _fallbackCall(_key);
        }
    }

    /// @inheritdoc IUmbrellaFeeds
    function getPriceDataRaw(bytes32 _key) external view returns (PriceData memory data) {
        data = prices[_key];

        if (data.timestamp == 0) {
            data = _fallbackCallRaw(_key);
        }
    }

    /// @dev to follow Registrable interface
    function getName() public pure returns (bytes32) {
        return "UmbrellaFeeds";
    }

    function _fallbackCall(bytes32 _key) internal view returns (PriceData memory) {
        address umbrellaFeeds = REGISTRY.getAddressByString(NAME);

        // if contract was NOT updated - revert
        if (umbrellaFeeds == address(this)) revert FeedNotExist();

        return UmbrellaFeeds(umbrellaFeeds).getPriceDataRaw(_key);
    }

    function _fallbackCallRaw(bytes32 _key) internal view returns (PriceData memory data) {
        address umbrellaFeeds = REGISTRY.getAddress(getName());

        // if contract was updated, we do a fallback call
        if (umbrellaFeeds != address(this) && umbrellaFeeds != address(0)) {
            return UmbrellaFeeds(umbrellaFeeds).getPriceDataRaw(_key);
        }

        // else - we return empty data
    }
}
