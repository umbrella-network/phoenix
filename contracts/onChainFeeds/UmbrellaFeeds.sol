// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "../interfaces/IUmbrellaFeeds.sol";
import "../interfaces/IRegistry.sol";
import "../interfaces/IStakingBankStatic.sol";

/// @dev Main contract for all on-chain data.
/// Check `UmbrellaFeedsReader` to see how to integrate.
///
/// @notice This contract can be destroyed and replaced with new one (with new address).
/// For best gas efficiency you should pick one of two ways of integration:
/// 1. make `UmbrellaFeeds` immutable and use fallback in case of selfdestruct. After new deployment, it is recommended
/// to update address to avoid fallback and reduce gas cost to minimum. In long run this is most efficient solution,
/// better than any proxy.
/// 2. always check newest `UmbrellaFeeds` via `Regostry` and fallback will not be needed.
contract UmbrellaFeeds is IUmbrellaFeeds {
    bytes constant public ETH_PREFIX = "\x19Ethereum Signed Message:\n32";
    string constant public NAME = "UmbrellaFeeds";

    /// @dev deployment time, used for protect for unintentional destroy
    uint256 public immutable DEPLOYED_AT;  // solhint-disable-line var-name-mixedcase

    /// @dev Registry contract where list of all addresses is stored. Fallback feature uses this registry to
    /// resolve newest `UmbrellaFeeds` address
    IRegistry public immutable REGISTRY;  // solhint-disable-line var-name-mixedcase

    /// @dev StakingBank contract where list of validators is stored
    IStakingBankStatic public immutable STAKING_BANK;  // solhint-disable-line var-name-mixedcase

    /// @dev minimal number of signatures required for accepting price submission (PoA)
    uint16 public immutable REQUIRED_SIGNATURES; // solhint-disable-line var-name-mixedcase

    /// @dev decimals for prices stored in this contract
    uint8 public immutable DECIMALS;  // solhint-disable-line var-name-mixedcase

    /// @notice map of all prices stored in this contract, key for map is hash of feed name
    /// eg for "ETH-USD" feed, key will be hash("ETH-USD")
    mapping (bytes32 => PriceData) private _prices;

    error ArraysDataDoNotMatch();
    error FeedNotExist();
    error NotEnoughSignatures();
    error InvalidSigner();
    error InvalidRequiredSignatures();
    error SignaturesOutOfOrder();
    error ECDSAInvalidSignatureS();
    error ECDSAInvalidSignatureV();
    error OldData();
    error ContractInUse();
    error ContractNotInitialised();

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
        STAKING_BANK = IStakingBankStatic(_contractRegistry.requireAndGetAddress("StakingBank"));
        DECIMALS = _decimals;
        DEPLOYED_AT = block.timestamp;
    }

    /// @dev destroys old contract
    /// there is sanity check that prevents abuse of destroy method
    /// @param _name string feed key to verify, that contract was initialised
    function destroy(string calldata _name) external {
        if (REGISTRY.getAddressByString(NAME) == address(this)) revert ContractInUse();

        if (_prices[keccak256(abi.encodePacked(_name))].timestamp == 0 && DEPLOYED_AT + 3 days > block.timestamp) {
            revert ContractNotInitialised();
        }

        selfdestruct(payable(msg.sender));
    }

    /// @inheritdoc IUmbrellaFeeds
    function update(
        bytes32[] calldata _priceKeys,
        PriceData[] calldata _priceDatas,
        Signature[] calldata _signatures
    ) external {
        if (_priceKeys.length != _priceDatas.length) revert ArraysDataDoNotMatch();

        bytes32 priceDataHash = keccak256(abi.encode(getChainId(), address(this), _priceKeys, _priceDatas));
        verifySignatures(priceDataHash, _signatures);

        uint256 i;

        while (i < _priceDatas.length) {
            bytes32 priceKey = _priceKeys[i];

            // we do not allow for older prices
            // at the same time it prevents from reusing signatures
            if (_prices[priceKey].timestamp >= _priceDatas[i].timestamp) revert OldData();

            _prices[priceKey] = _priceDatas[i];

            // atm there is no need for events, so in order to save gas, we do not emit any
            unchecked { i++; }
        }
    }

    /// @inheritdoc IUmbrellaFeeds
    function getManyPriceData(bytes32[] calldata _keys) external view returns (PriceData[] memory data) {
        data = new PriceData[](_keys.length);

        for (uint256 i; i < _keys.length;) {
            data[i] = _prices[_keys[i]];
            if (data[i].timestamp == 0) revert FeedNotExist();

            unchecked { i++; }
        }
    }

    /// @inheritdoc IUmbrellaFeeds
    function getManyPriceDataRaw(bytes32[] calldata _keys) external view returns (PriceData[] memory data) {
        data = new PriceData[](_keys.length);

        for (uint256 i; i < _keys.length;) {
            data[i] = _prices[_keys[i]];
            unchecked { i++; }
        }
    }

    /// @inheritdoc IUmbrellaFeeds
    function prices(bytes32 _key) external view returns (PriceData memory data) {
        data = _prices[_key];
    }

    /// @inheritdoc IUmbrellaFeeds
    function getPriceData(bytes32 _key) external view returns (PriceData memory data) {
        data = _prices[_key];
        if (data.timestamp == 0) revert FeedNotExist();
    }

    /// @inheritdoc IUmbrellaFeeds
    function getPrice(bytes32 _key) external view returns (uint128 price) {
        PriceData memory data = _prices[_key];
        if (data.timestamp == 0) revert FeedNotExist();

        return data.price;
    }

    /// @inheritdoc IUmbrellaFeeds
    function getPriceTimestamp(bytes32 _key) external view returns (uint128 price, uint32 timestamp) {
        PriceData memory data = _prices[_key];
        if (data.timestamp == 0) revert FeedNotExist();

        return (data.price, data.timestamp);
    }

    function getPriceTimestampHeartbeat(bytes32 _key)
        external
        view
        returns (uint128 price, uint32 timestamp, uint24 heartbeat)
    {
        PriceData memory data = _prices[_key];
        if (data.timestamp == 0) revert FeedNotExist();

        return (data.price, data.timestamp, data.heartbeat);
    }

    /// @inheritdoc IUmbrellaFeeds
    function getPriceDataByName(string calldata _name) external view returns (PriceData memory data) {
        bytes32 key = keccak256(abi.encodePacked(_name));
        data = _prices[key];
    }

    /// @dev helper method for QA purposes
    /// @return hash of data that are signed by validators (keys and priced data)
    function hashData(bytes32[] calldata _priceKeys, PriceData[] calldata _priceDatas)
        external
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(getChainId(), address(this), _priceKeys, _priceDatas));
    }

    /// @param _hash hash of signed data
    /// @param _signatures array of validators signatures
    function verifySignatures(bytes32 _hash, Signature[] calldata _signatures) public view {
        address prevSigner = address(0x0);

        if (_signatures.length < REQUIRED_SIGNATURES) revert NotEnoughSignatures();

        address[] memory validators = new address[](REQUIRED_SIGNATURES);

        // to save gas we check only required number of signatures
        // case, where you can have part of signatures invalid but still enough valid in total is not supported
        for (uint256 i; i < REQUIRED_SIGNATURES;) {
            (uint8 v, bytes32 r, bytes32 s) = (_signatures[i].v, _signatures[i].r, _signatures[i].s);

            if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
                revert ECDSAInvalidSignatureS();
            }

            if (uint8(v) != 27 && uint8(v) != 28) revert ECDSAInvalidSignatureV();

            address signer = recoverSigner(_hash, v, r, s);
            if (prevSigner >= signer) revert SignaturesOutOfOrder();

            // because we check only required number of signatures, any invalid one will cause revert
            prevSigner = signer;
            validators[i] = signer;

            unchecked { i++; }
        }

        // bulk verification can optimise gas when we have 5 or more validators
        if (!STAKING_BANK.verifyValidators(validators)) revert InvalidSigner();
    }

    function getChainId() public view returns (uint256 id) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            id := chainid()
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

    /// @dev to follow Registrable interface
    function getName() public pure returns (bytes32) {
        return "UmbrellaFeeds";
    }
}
