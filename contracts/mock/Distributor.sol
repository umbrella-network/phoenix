// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";

import "../Registry.sol";

contract Distributor is Ownable {
  address[] public recipients;
  uint256 public bottomLimit = 5e17;
  uint256 public topLimit = 1e18;

  constructor(address[] memory _recipients) public {
    recipients = _recipients;
  }

  function getName() external pure returns (bytes32) {
    return "Distributor";
  }

  function recipientsCount() external view returns (uint256) {
    return recipients.length;
  }

  function allRecipients() external view returns (address[] memory) {
    return recipients;
  }
  
  function setLimits(uint256 _bottom, uint256 _top) external onlyOwner {
    bottomLimit = _bottom;
    topLimit = _top;
  }

  function withdraw() external {
    uint balance = address(this).balance;
    uint buffer = recipients.length * (topLimit - bottomLimit);

    if (balance > buffer) {
      payable(owner()).transfer(balance - buffer);
    }
  }

  function addRecipients(address[] calldata _recipients) external onlyOwner {
    for (uint256 i = 0; i < _recipients.length; i++) {
      recipients.push(_recipients[i]);
    }
  }
  
  function removeRecipient(address _recipient) external onlyOwner {
    for (uint256 i = 0; i < recipients.length; i++) {
      if (recipients[i] == _recipient) {
        recipients[i] = recipients[recipients.length - 1];
        recipients.pop();
        return;
      }
    }
  }

  function distribute() public {
    uint256 limit = bottomLimit;
    uint256 top = topLimit;
    uint256 count = recipients.length;
    uint256 totalBalance = address(this).balance;

    for (uint256 i = 0; i < count; i++) {
      uint256 balance = recipients[i].balance;

      if (balance > limit) {
        continue;
      }

      uint256 amount = top - balance > totalBalance ? totalBalance : top - balance;

      if (amount > 0) {
        payable(recipients[i]).transfer(amount);
        totalBalance -= amount;
      }
    }
  }

  receive() external payable {
    distribute();
  }
}
