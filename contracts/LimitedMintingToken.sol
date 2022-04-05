// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IStakingBank.sol";

contract LimitedMintingToken is ERC20, Ownable {
  struct MintData {
    uint256 dailyAllowance;
    mapping (address => uint256) lastMintTimestamp;
    mapping (address => uint256) todaysMintedAmount;
  }

  MintData public mintData;

  constructor(
    string memory _name,
    string memory _symbol,
    uint256 _dailyAllowance
    ) public ERC20(_name, _symbol) {
      mintData.dailyAllowance = _dailyAllowance;
  }

  function mint(address _holder, uint256 _amount) external {
    MintData storage data = mintData;

    (uint256 limit, bool fullLimit) = _currentLimit(data);

    require(limit > 0, "This address already claimed the maximum daily amount");

    uint256 lastTimestamp = data.lastMintTimestamp[msg.sender];
    uint256 mintedAmount = data.todaysMintedAmount[msg.sender];

    uint256 amount = _amount > limit ? limit : _amount;
    data.lastMintTimestamp[msg.sender] = fullLimit ? block.timestamp : lastTimestamp; 
    data.todaysMintedAmount[msg.sender] = fullLimit ? amount : mintedAmount + amount;

    _mint(_holder, amount);
  }

  function mintApproveAndStake(IStakingBank _stakingBank, address _holder, uint256 _amount) external {
    _mint(_holder, _amount);
    _approve(_holder, address(_stakingBank), _amount);
    _stakingBank.receiveApproval(_holder);
  }

  function getName() external pure returns (bytes32) {
    return "UMB";
  }

  function getDailyAllowance() external view returns (uint256) {
    return mintData.dailyAllowance;
  }

  function setDailyAllowance(uint256 newDailyAllowance) public onlyOwner {
    MintData storage data = mintData;
    data.dailyAllowance = newDailyAllowance;
  }

  function _currentLimit(MintData storage data) internal view returns (uint256 limit, bool fullLimit) {
    uint256 lastMint = data.lastMintTimestamp[msg.sender];
    fullLimit = block.timestamp - lastMint >= 24 hours;

    uint256 usedLimit = data.todaysMintedAmount[msg.sender];

    limit = fullLimit ? data.dailyAllowance : data.dailyAllowance - usedLimit;
  }
}
