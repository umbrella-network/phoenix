import { ethers } from 'hardhat';

export const mintBlocks = async (count = 1): Promise<void> => {
  while (count-- > 0) {
    await ethers.provider.send('evm_mine', []);
  }
};

export const timeTravel = async (addTime: number): Promise<number> => {
  console.log('blockchain time before:', await blockTimestamp());
  await ethers.provider.send('evm_increaseTime', [addTime]);
  await ethers.provider.send('evm_mine', []);
  const t = await blockTimestamp();
  console.log('blockchain time now:', t);
  return t;
};

export const blockTimestamp = async (): Promise<number> => {
  const block = await ethers.provider.getBlock('latest');
  return block.timestamp;
};

export const blockNumber = async (): Promise<number> => {
  const block = await ethers.provider.getBlock('latest');
  return block.number;
};
