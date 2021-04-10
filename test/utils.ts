import { ethers } from 'hardhat';

export const mintBlocks = async (count = 1): Promise<void> => {
  while (count-- > 0) {
    await ethers.provider.send('evm_mine', []);
  }
};
