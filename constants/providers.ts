import {
  ARBITRUM_PRODUCTION,
  ARBITRUM_SANDBOX,
  ARBITRUM_STAGING,
  ARTHERA_SANDBOX,
  ASTAR_SANDBOX,
  AVALANCHE_PRODUCTION,
  AVALANCHE_SANDBOX,
  AVALANCHE_STAGING,
  BASE_PRODUCTION,
  BASE_SANDBOX,
  BASE_STAGING,
  BNB,
  BNB_PRODUCTION,
  BNB_SANDBOX,
  BNB_STAGING,
  ETH_PRODUCTION,
  ETH_SANDBOX,
  ETH_STAGING,
  FORKED_BNB_ID,
  FORKED_ETH_ID,
  LINEA_PRODUCTION,
  LINEA_SANDBOX,
  LINEA_STAGING,
  MELD_SANDBOX,
  OKX_SANDBOX,
  POLYGON_PRODUCTION,
  POLYGON_SANDBOX,
  POLYGON_STAGING,
  XDC_SANDBOX,
} from './networks';

const { INFURA_ID, FAKE_MAINNET, FORKING_ENV, CHAIN_ID } = process.env;

type ProviderData = { url: string; chainId: number };

const chainId = (id: number): number => {
  const netId = parseInt(CHAIN_ID || id.toString(10), 10);
  return FAKE_MAINNET ? netId * 10_000 : netId;
};

export const forkingChainId = (): number => {
  switch (FORKING_ENV) {
    case BNB:
      return FORKED_BNB_ID;

    case 'eth':
      return FORKED_ETH_ID;

    default:
      return parseInt(CHAIN_ID || '8545', 10);
  }
};

const localProviderData: ProviderData = {
  url: 'http://localhost:8545',
  chainId: forkingChainId(),
};

const lineaTestnetProviderData: ProviderData = {
  url: `https://linea-goerli.infura.io/v3/${INFURA_ID}`,
  chainId: chainId(59140),
};

// https://docs.xdc.community/get-details/wallet-integration/metamask
// https://docs.xdc.community/get-details/networks/apothem
const apothemTestnetProviderData: ProviderData = {
  url: 'https://earpc.apothem.network', // <-- this is for smart contract deployment, https://rpc.apothem.network'
  chainId: chainId(51),
};

// https://docs.astar.network/docs/build/environment/endpoints/
const astarTestnetProviderData: ProviderData = {
  url: 'https://rpc.startale.com/zkatana',
  chainId: chainId(1261120),
};

// https://www.okx.com/pl/x1/docs/getting-started/user-guide/network-information
// https://www.okx.com/pl/x1/faucet
const okxTestnetProviderData: ProviderData = {
  url: 'https://testrpc.x1.tech',
  chainId: chainId(195),
};

// https://docs.arthera.net/build/developing-sc/intro#arthera-testnet-network-info
const artheraTestnetProviderData: ProviderData = {
  url: 'https://rpc-test.arthera.net',
  chainId: chainId(10243),
};

const meldTestnetProviderData: ProviderData = {
  url: 'https://testnet-rpc.meld.com',
  chainId: chainId(222000222),
};

const baseTestnetProviderData: ProviderData = {
  url: 'https://base-goerli.public.blastapi.io',
  chainId: chainId(84531),
};

const arbitrumTestnetProviderData: ProviderData = {
  url: `https://arbitrum-sepolia.infura.io/v3/${INFURA_ID}`,
  chainId: chainId(421614),
};

const avaxTestnetProviderData: ProviderData = {
  url: 'https://api.avax-test.network/ext/bc/C/rpc',
  chainId: chainId(43113),
};

const bnbTestnetProviderData: ProviderData = {
  url: 'https://data-seed-prebsc-2-s1.binance.org:8545',
  // url: 'https://data-seed-prebsc-1-s3.binance.org:8545',
  chainId: chainId(97),
};

const ethTestnetProviderData: ProviderData = {
  url: `https://goerli.infura.io/v3/${INFURA_ID}`,
  chainId: chainId(5),
};

const polygonTestnetProviderData: ProviderData = {
  url: `https://polygon-mumbai.infura.io/v3/${INFURA_ID}`,
  chainId: chainId(80001),
};

const arbitrumMainnetProviderData: ProviderData = {
  url: `https://arbitrum-mainnet.infura.io/v3/${INFURA_ID}`,
  chainId: chainId(42161),
};

const avaxMainnetProviderData: ProviderData = {
  url: 'https://api.avax.network/ext/bc/C/rpc',
  chainId: 43114,
};

const bnbMainnetProviderData: ProviderData = {
  url: 'https://bsc-dataseed.binance.org/',
  chainId: chainId(56),
};

const polygonMainnetProviderData: ProviderData = {
  url: `https://polygon-mainnet.infura.io/v3/${INFURA_ID}`,
  chainId: chainId(137),
};

const ethMainnetProviderData: ProviderData = {
  url: `https://mainnet.infura.io/v3/${INFURA_ID}`,
  chainId: chainId(1),
};

const lineaMainnetProviderData: ProviderData = {
  url: `https://linea-mainnet.infura.io/v3/${INFURA_ID}`,
  chainId: chainId(59144),
};

const baseMainnetProviderData: ProviderData = {
  url: 'https://base-mainnet.public.blastapi.io',
  chainId: chainId(8453),
};

const resolveProviderData = (networkName: string): ProviderData => {
  switch (networkName) {
    case OKX_SANDBOX:
      return okxTestnetProviderData;

    case ASTAR_SANDBOX:
      return astarTestnetProviderData;

    case ARTHERA_SANDBOX:
      return artheraTestnetProviderData;

    case XDC_SANDBOX:
      return apothemTestnetProviderData;

    case MELD_SANDBOX:
      return meldTestnetProviderData;

    case LINEA_STAGING:
    case LINEA_SANDBOX:
      return lineaTestnetProviderData;

    case BASE_STAGING:
    case BASE_SANDBOX:
      return baseTestnetProviderData;

    case ARBITRUM_STAGING:
    case ARBITRUM_SANDBOX:
      return arbitrumTestnetProviderData;

    case AVALANCHE_STAGING:
    case AVALANCHE_SANDBOX:
      return avaxTestnetProviderData;

    case ETH_STAGING:
    case ETH_SANDBOX:
      return ethTestnetProviderData;

    case BNB_STAGING:
    case BNB_SANDBOX:
      return bnbTestnetProviderData;

    case POLYGON_STAGING:
    case POLYGON_SANDBOX:
      return polygonTestnetProviderData;

    case ARBITRUM_PRODUCTION:
      return arbitrumMainnetProviderData;

    case AVALANCHE_PRODUCTION:
      return avaxMainnetProviderData;

    case BNB_PRODUCTION:
      return bnbMainnetProviderData;

    case POLYGON_PRODUCTION:
      return polygonMainnetProviderData;

    case ETH_PRODUCTION:
      return ethMainnetProviderData;

    case LINEA_PRODUCTION:
      return lineaMainnetProviderData;

    case BASE_PRODUCTION:
      return baseMainnetProviderData;
  }

  throw new Error(`${networkName} not supported`);
};

export const getProviderData = (networkName: string): ProviderData => {
  const data = resolveProviderData(networkName);

  if (FAKE_MAINNET) {
    return {
      url: localProviderData.url,
      chainId: data.chainId,
    };
  }

  return data;
};
