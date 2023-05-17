// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "../interfaces/IRegistry.sol";
import "../interfaces/IStakingBank.sol";

import "./UmbrellaFeedsReader.sol";

/// @notice Factory to deploy UmbrellaFeedsReader contract
contract UmbrellaFeedsReaderFactory {
    /// @dev Registry contract where list of all addresses is stored. Used to resolve newest `UmbrellaFeeds` address
    IRegistry public immutable REGISTRY; // solhint-disable-line var-name-mixedcase

    /// @dev list of all readers
    mapping (bytes32 => UmbrellaFeedsReader) public readers;

    event NewUmbrellaFeedsReader(UmbrellaFeedsReader indexed umbrellaFeedsReader, string feedName);

    error EmptyAddress();

    constructor(IRegistry _registry) {
        if (address(_registry) == address(0)) revert EmptyAddress();

        REGISTRY = _registry;
    }

    /// @dev Method to deploy new UmbrellaFeedsReader for particular key.
    /// This deployment is optional and it can be done by anyone who needs it.
    /// Reader can be used to simplify migration from Chainlink to Umbrella.
    ///
    /// Check UmbrellaFeedsReader docs for more details.
    ///
    /// We not using minimal proxy because it does not allow for immutable variables.
    /// @param _feedName string Feed name that is registered in UmbrellaFeeds
    /// @return reader UmbrellaFeedsReader contract address, in case anyone wants to use it from Layer1
    function deploy(string memory _feedName) external returns (UmbrellaFeedsReader reader) {
        reader = deployed(_feedName);
        IUmbrellaFeeds umbrellaFeeds = IUmbrellaFeeds(REGISTRY.getAddressByString("UmbrellaFeeds"));

        // if UmbrellaFeeds contract is up to date, there is no need to redeploy
        if (address(reader) != address(0) && address(reader.UMBRELLA_FEEDS()) == address(umbrellaFeeds)) {
            return reader;
        }

        reader = new UmbrellaFeedsReader(umbrellaFeeds, _feedName);
        readers[hash(_feedName)] = reader;

        emit NewUmbrellaFeedsReader(reader, _feedName);
    }

    function deployed(string memory _feedName) public view returns (UmbrellaFeedsReader) {
        return readers[hash(_feedName)];
    }

    function hash(string memory _feedName) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_feedName));
    }

    /// @dev to follow Registrable interface
    function getName() public pure returns (bytes32) {
        return "UmbrellaFeedsReaderFactory";
    }
}
