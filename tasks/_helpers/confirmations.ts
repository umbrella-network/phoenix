import {
  ARBITRUM_PRODUCTION,
  ARBITRUM_SANDBOX,
  ARBITRUM_STAGING,
  AVALANCHE_PRODUCTION,
  AVALANCHE_SANDBOX, AVALANCHE_STAGING, POLYGON_PRODUCTION, POLYGON_SANDBOX, POLYGON_STAGING
} from "../../constants/networks";

export function confirmations(networkName: string): number {
  switch (networkName) {
    case ARBITRUM_PRODUCTION:
    case ARBITRUM_SANDBOX:
    case ARBITRUM_STAGING:
    case AVALANCHE_PRODUCTION:
    case AVALANCHE_SANDBOX:
    case AVALANCHE_STAGING:
      return 8;

    case POLYGON_PRODUCTION:
    case POLYGON_SANDBOX:
    case POLYGON_STAGING:
      return 3;

    default: return 1;
  }
}
