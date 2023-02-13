import {AVALANCHE_PRODUCTION, BNB_PRODUCTION, LOCALHOST, POLYGON_PRODUCTION} from './networks';

const {
  DEPLOYER_PK,
  STAGING_DEPLOYER_PK,
  PROD_DEPLOYER_PK,
  FORKING_ENV,
  FAKE_MAINNET
} = process.env;

const localAccounts = DEPLOYER_PK
  ? [DEPLOYER_PK]
  : ['0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122'];

const stagingAccounts = STAGING_DEPLOYER_PK ? [STAGING_DEPLOYER_PK] : [];
const prodAccounts = PROD_DEPLOYER_PK ? [PROD_DEPLOYER_PK] : [];

export const PROD_PK = 'prod';

export function getPrivteKeys(network = ''): string[] {
  if (FORKING_ENV || FAKE_MAINNET) {
    return prodAccounts;
  }

  switch (network) {
    case LOCALHOST:
      return stagingAccounts;

    case PROD_PK:
    case AVALANCHE_PRODUCTION:
    case BNB_PRODUCTION:
    case POLYGON_PRODUCTION:
      return prodAccounts;

    default: return localAccounts;
  }
}