export const ETH = 'ethereum';
export const BNB = 'bnb';
export const BNB_SANDBOX = 'bnb_sandbox';

export const LOCALHOST = 'localhost';
export const HARDHAT = 'hardhat';

export const LINEA_STAGING = 'linea_staging';
export const ARBITRUM_STAGING = 'arbitrum_staging';
export const AVALANCHE_STAGING = 'avalanche_staging';
export const BNB_STAGING = 'bnb_staging';
export const ETH_STAGING = 'eth_staging';
export const POLYGON_STAGING = 'polygon_staging';

export const ARBITRUM_SANDBOX = 'arbitrum_sandbox';
export const AVALANCHE_SANDBOX = 'avalanche_sandbox';
export const POLYGON_SANDBOX = 'polygon_sandbox';
export const ETH_SANDBOX = 'eth_sandbox';

export const ARBITRUM_PRODUCTION = 'arbitrum_production';
export const AVALANCHE_PRODUCTION = 'avalanche_production';
export const ETH_PRODUCTION = 'eth_production';
export const POLYGON_PRODUCTION = 'polygon_production';
export const BNB_PRODUCTION = 'bnb_production';


export const MASTER_CHAIN_NAME = BNB;

export const FORKED_BNB_ID = 560000;
export const FORKED_ETH_ID = 111111;

const LOCALHOST_ID = 8545;
const BNB_ID = 56;
const BNB_STAGING_ID = 97;

export const isMasterChain = (chainId: number | string): boolean => {
  const { FORKING_ENV } = process.env;

  if (FORKING_ENV) {
    return FORKING_ENV == MASTER_CHAIN_NAME;
  }

  const masterChain = [LOCALHOST_ID, BNB_ID, BNB_STAGING_ID, FORKED_BNB_ID]
    .includes(parseInt(`${chainId}`, 10));

  console.log(`isMasterChain(${chainId})?`, masterChain);
  return masterChain;
};
