pragma solidity ^0.8.0;

import "./CheatCodes.sol";

contract MockContract {}

library Mock {
    // DSTest is a contract so we can't get this constant from it
    // Eventually we should refactor our foundry test suite
    address constant HEVM_ADDRESS =
        address(bytes20(uint160(uint256(keccak256("hevm cheat code")))));

    function create(string memory label) internal returns(address mock) {
        mock = address(new MockContract());
        CheatCodes(HEVM_ADDRESS).label(mock, label);
    }
}
