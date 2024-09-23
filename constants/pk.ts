import {
  ARBITRUM_PRODUCTION,
  AVALANCHE_PRODUCTION,
  BASE_PRODUCTION,
  BNB_PRODUCTION,
  ETH_PRODUCTION,
  LINEA_PRODUCTION,
  LOCALHOST,
  POLYGON_PRODUCTION,
  ROOTSTOCK_PRODUCTION,
} from './networks';

const { DEPLOYER_PK, STAGING_DEPLOYER_PK, PROD_DEPLOYER_PK, FORKING_ENV, FAKE_MAINNET } = process.env;

const localAccounts = DEPLOYER_PK
  ? [DEPLOYER_PK]
  : ['0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122'];

const stagingAccounts = STAGING_DEPLOYER_PK ? [STAGING_DEPLOYER_PK] : [];
const prodAccounts = PROD_DEPLOYER_PK ? [PROD_DEPLOYER_PK] : [];

export const PROD_PK = 'prod';

export function getPrivateKeys(network = ''): string[] {
  if (FORKING_ENV || FAKE_MAINNET) {
    return prodAccounts;
  }

  switch (network) {
    case LOCALHOST:
      return stagingAccounts;

    case PROD_PK:
    case AVALANCHE_PRODUCTION:
    case ARBITRUM_PRODUCTION:
    case BNB_PRODUCTION:
    case POLYGON_PRODUCTION:
    case ETH_PRODUCTION:
    case LINEA_PRODUCTION:
    case BASE_PRODUCTION:
    case ROOTSTOCK_PRODUCTION:
      return prodAccounts;

    default:
      return localAccounts;
  }
}
