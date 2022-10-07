export const ETH = 'ethereum';
export const ARBITRUM = 'arbitrum';
export const POLYGON = 'polygon';
export const AVALANCHE = 'avalanche';
export const RINKEBY = 'rinkeby';
export const GOERLI = 'goerli';
export const KOVAN = 'kovan';
export const BSC = 'bsc';
export const BSC_STAGING = 'bsc_staging';
export const POLYGON_STAGING = 'polygon_staging';
export const AVALANCHE_STAGING = 'avalanche_staging';
export const BSC_SANDBOX = 'bsc_sandbox';
export const LOCALHOST = 'localhost';
export const HARDHAT = 'hardhat';

export const MASTER_CHAIN = BSC;

export const FORKED_BSC_ID = 560000;
export const FORKED_ETH_ID = 111111;

const LOCALHOST_ID = 8545;
const HARDHAT_ID = 8545;
const BSC_ID = 56;
const BSC_STAGING_ID = 97;

export const isMasterChain = (chainId: number | string): boolean => {
  const masterChain = (process.env.FORKING_ENV == MASTER_CHAIN)
    || [LOCALHOST_ID, HARDHAT_ID, BSC_ID, BSC_STAGING_ID, FORKED_BSC_ID].includes(parseInt(`${chainId}`, 10));

  console.log(`isMasterChain(${chainId})?`, masterChain);
  return masterChain;
};
