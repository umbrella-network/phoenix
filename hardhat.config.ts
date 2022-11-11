import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import 'hardhat-gas-reporter';
import '@nomiclabs/hardhat-solhint';
import '@nomiclabs/hardhat-etherscan';
import 'solidity-coverage';

// there is undefined issue in this repo, ts-node is ignoring flag TS_NODE_TRANSPILE_ONLY=1 and throw errors
// on missing typechain/
if (!process.env.TS_NODE_TRANSPILE_ONLY) {
  require('./tasks');
}

import {HardhatNetworkForkingUserConfig, HardhatUserConfig} from 'hardhat/types';
import {ARBITRUM, AVALANCHE, BSC, ETH, FORKED_BSC_ID, FORKED_ETH_ID, POLYGON} from './constants/networks';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const {
  HARDHAT_NETWORK = '',
  INFURA_ID,
  DEPLOYER_PK,
  STAGING_DEPLOYER_PK,
  PROD_DEPLOYER_PK,
  HARDHAT_MINING_AUTO = 'true',
  HARDHAT_MINING_INTERVAL = '5000',
  BSCSCAN_API = '',
  ETHERSCAN_API = '',
  POLYGONSCAN_API = '',
  AVASCAN_API = '',
  ARBISCAN_API = '',
  FORKING_ENV,
  FORKING_BLOCK_NUMBER,
  STAGING
} = process.env;

const balance = '1000' + '0'.repeat(18);
const autoMinting = HARDHAT_MINING_AUTO === 'true';

const localAccounts = DEPLOYER_PK ? [DEPLOYER_PK] : [];
const stagingAccounts = STAGING_DEPLOYER_PK ? [STAGING_DEPLOYER_PK] : [];
const prodAccounts = PROD_DEPLOYER_PK ? [PROD_DEPLOYER_PK] : [];

const blockchain = HARDHAT_NETWORK.split('_')[0];

const apiKey = (): string | Record<string, string> => {
  switch (blockchain) {
    case ARBITRUM:
      return ARBISCAN_API;
    case AVALANCHE:
      return AVASCAN_API;
    case POLYGON:
      return POLYGONSCAN_API;
    case ETH:
      return ETHERSCAN_API;
    case BSC:
      return BSCSCAN_API;
    default:
      return {
        'mainnet': ETHERSCAN_API,
        'goerli': ETHERSCAN_API,
        // bsc
        'bsc': BSCSCAN_API,
        'bscTestnet': BSCSCAN_API,
        // polygon
        'polygon': POLYGONSCAN_API,
        'polygonMumbai': POLYGONSCAN_API,
        // arbitrum
        'arbitrumOne': ARBISCAN_API,
        'arbitrumTestnet': ARBISCAN_API,
        // avalanche
        'avalanche': AVASCAN_API,
        'avalancheFujiTestnet': AVASCAN_API,
      };
  }
};

const bscRpcUrlTestnet = 'https://data-seed-prebsc-2-s1.binance.org:8545';

console.log({autoMinting, HARDHAT_MINING_INTERVAL});

const gwei = (n: number): number => n * 1e9;

const forkingChainId = (): number => {
  switch (FORKING_ENV) {
    case BSC:
      return FORKED_BSC_ID;

    case 'eth':
      return FORKED_ETH_ID;

    default:
      return 880088;
  }
};

let forkingConfig: {
  forking: HardhatNetworkForkingUserConfig;
  deploy: string[];
} | undefined;

switch (FORKING_ENV) {
  case 'bsc':
    forkingConfig = {
      forking: {
        enabled: true,
        blockNumber: FORKING_BLOCK_NUMBER ? parseInt(FORKING_BLOCK_NUMBER, 10) : undefined,
        url: 'https://flashy-fittest-lambo.bsc.discover.quiknode.pro/72b200feabb7787e65699c8a082aa27ac59ddcf2/',
      },
      deploy: ['deploy/evm'],
    };
    break;

  case 'eth':
    forkingConfig = {
      forking: {
        enabled: true,
        blockNumber: FORKING_BLOCK_NUMBER ? parseInt(FORKING_BLOCK_NUMBER, 10) : undefined,
        url: `https://mainnet.infura.io/v3/${INFURA_ID}`,
      },
      deploy: ['deploy/evm'],
    };
    break;

  default:
    if (FORKING_ENV) throw Error(`unknown forking settings ${FORKING_ENV}`);
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

console.log(forkingConfig);

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      blockGasLimit: 80000000,
      accounts: [
        {
          balance,
          privateKey: FORKING_ENV
            ? prodAccounts[0]
            // 0xc783df8a850f42e7f7e57013759c285caa701eb6
            : '0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122'
        },
        // 0xead9c93b79ae7c1591b1fb5323bd777e86e150d4
        {balance, privateKey: '0xd49743deccbccc5dc7baa8e69e5be03298da8688a15dd202e20f15d5e0e9a9fb'},
        // 0xe5904695748fe4a84b40b3fc79de2277660bd1d3
        {balance, privateKey: '0x23c601ae397441f3ef6f1075dcb0031ff17fb079837beadaf3c84d96c6f3e569'},
        // 0x2ffd013aaa7b5a7da93336c2251075202b33fb2b
        {balance, privateKey: '0x87630b2d1de0fbd5044eb6891b3d9d98c34c8d310c852f98550ba774480e47cc'},
        {balance, privateKey: '0x275cc4a2bfd4f612625204a20a2280ab53a6da2d14860c47a9f5affe58ad86d4'},
        {balance, privateKey: '0xee9d129c1997549ee09c0757af5939b2483d80ad649a0eda68e8b0357ad11131'}
      ],
      forking: forkingConfig ? {...forkingConfig.forking} : undefined,
      chainId: forkingChainId(),
      live: false,
      saveDeployments: true,
      deploy: ['deploy/evm'],
      mining: forkingConfig ? {
        auto: false,
        interval: parseInt(HARDHAT_MINING_INTERVAL || '3000', 10),
        mempool: {
          order: 'fifo'
        }
      } : {
        auto: autoMinting,
        interval: autoMinting ? 0 : parseInt(HARDHAT_MINING_INTERVAL || '0', 10),
      },
    },
    localhost: {
      blockGasLimit: 80000000,
      url: 'http://localhost:8545',
      accounts: STAGING ? prodAccounts : localAccounts,
      live: false,
      saveDeployments: true,
      deploy: ['deploy/evm'],
    },
    avalanche_staging: {
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      accounts: stagingAccounts,
      chainId: 43113,
      gasPrice: gwei(25)
    },
    bsc_staging: {
      url: bscRpcUrlTestnet,
      accounts: stagingAccounts,
      chainId: 97,
      gasPrice: gwei(10)
    },
    ethereum_staging: {
      url: `https://goerli.infura.io/v3/${INFURA_ID}`,
      accounts: stagingAccounts,
      chainId: 5,
      gasPrice: 'auto'
    },
    polygon_staging: {
      url: `https://polygon-mumbai.infura.io/v3/${INFURA_ID}`,
      accounts: stagingAccounts,
      chainId: 80001,
      gasPrice: gwei(1)
    },
    arbitrum_staging: {
      url: `https://arbitrum-rinkeby.infura.io/v3/${INFURA_ID}`,
      accounts: stagingAccounts,
      chainId: 421611,
      gasPrice: 'auto'
    },
    arbitrum_sandbox: {
      url: `https://arbitrum-rinkeby.infura.io/v3/${INFURA_ID}`,
      accounts: stagingAccounts,
      chainId: 421611,
      gasPrice: 'auto'
    },
    avalanche_sandbox: {
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      accounts: stagingAccounts,
      chainId: 43113,
      gasPrice: gwei(25)
    },
    polygon_sandbox: {
      url: `https://polygon-mumbai.infura.io/v3/${INFURA_ID}`,
      accounts: stagingAccounts,
      chainId: 80001,
      gasPrice: gwei(1)
    },
    ethereum_sandbox: {
      url: `https://goerli.infura.io/v3/${INFURA_ID}`,
      accounts: stagingAccounts,
      chainId: 5,
      gasPrice: 'auto'
    },
    bsc_sandbox: {
      url: bscRpcUrlTestnet,
      accounts: stagingAccounts,
      chainId: 97,
      gasPrice: gwei(10)
    },
    arbitrum_production: {
      url: `https://arbitrum-mainnet.infura.io/v3/${INFURA_ID}`,
      accounts: prodAccounts,
      chainId: 42161,
      gasPrice: 'auto',
    },
    avalanche_production: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      accounts: prodAccounts,
      chainId: 43114,
      gasPrice: 'auto',
    },
    ethereum_production: {
      url: `https://mainnet.infura.io/v3/${INFURA_ID}`,
      accounts: prodAccounts,
      chainId: 1,
      live: true,
      gasPrice: 'auto',
      gasMultiplier: 1.5
    },
    bsc_production: {
      url: 'https://bsc-dataseed.binance.org/',
      accounts: prodAccounts,
      chainId: 56,
      gasPrice: gwei(5),
      live: true
    },
    polygon_production: {
      url: `https://polygon-mainnet.infura.io/v3/${INFURA_ID}`,
      accounts: prodAccounts,
      chainId: 137,
      live: true,
      gasPrice: 'auto',
      gasMultiplier: 2
    },
    docker: {
      url: 'http://eth:8545',
    },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://bscscan.com/
    apiKey: apiKey()
  },
  gasReporter: {
    gasPrice: 1,
    currency: 'USD',
    enabled: true || !!process.env.REPORT_GAS,
    maxMethodDiff: 10,
  },
  paths: {
    artifacts: 'artifacts',
    cache: 'cache',
    deploy: 'deploy/evm',
    deployments: 'deployments',
    imports: 'imports',
    sources: 'contracts',
    tests: 'test',
  },
  solidity: {
    compilers: [
      {
        version: '0.8.13'
      },
    ]
  },
  namedAccounts: {
    deployer: 0,
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
    alwaysGenerateOverloads: true,
  },
};

export default config;
