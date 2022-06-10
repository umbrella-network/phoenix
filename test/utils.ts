import { ethers } from 'hardhat';

export const mintBlocks = async (count = 1): Promise<void> => {
  while (count-- > 0) {
    await ethers.provider.send('evm_mine', []);
  }
};

export const increaseTime = async (addTime: number): Promise<void> => {
  await ethers.provider.send('evm_increaseTime', [addTime]);
};

export const blockTimestamp = async (): Promise<number> => {
  const block = await ethers.provider.getBlock('latest');
  return block.timestamp;
};
