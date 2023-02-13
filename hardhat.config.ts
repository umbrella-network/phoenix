import 'dotenv/config';
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
import {
  ARBITRUM_PRODUCTION,
  ARBITRUM_SANDBOX,
  ARBITRUM_STAGING, AVALANCHE_PRODUCTION, AVALANCHE_SANDBOX,
  AVALANCHE_STAGING,
  BNB, BNB_PRODUCTION, BNB_SANDBOX,
  BNB_STAGING, ETH, ETH_PRODUCTION, ETH_SANDBOX,
  ETH_STAGING,
  LOCALHOST, POLYGON_PRODUCTION, POLYGON_SANDBOX, POLYGON_STAGING
} from './constants/networks';
import {getPrivteKeys, PROD_PK} from './constants/pk';
import {forkingChainId, getProviderData} from './constants/providers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const {
  INFURA_ID,
  HARDHAT_MINING_AUTO = 'true',
  HARDHAT_MINING_INTERVAL = '5000',
  BSCSCAN_API = '',
  ETHERSCAN_API = '',
  POLYGONSCAN_API = '',
  AVASCAN_API = '',
  ARBISCAN_API = '',
  FORKING_ENV,
  FORKING_BLOCK_NUMBER,
  CHAIN_ID
} = process.env;

const balance = '1000' + '0'.repeat(18);
const autoMinting = HARDHAT_MINING_AUTO === 'true';

const apiKey = (): string | Record<string, string> => {
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
    'arbitrumGoerli': ARBISCAN_API,
    // avalanche
    'avalanche': AVASCAN_API,
    'avalancheFujiTestnet': AVASCAN_API,
  };
};

console.log({autoMinting, HARDHAT_MINING_INTERVAL});

const gwei = (n: number): number => n * 1e9;

let forkingConfig: {
  forking: HardhatNetworkForkingUserConfig;
  deploy: string[];
} | undefined;

switch (FORKING_ENV) {
  case BNB:
    forkingConfig = {
      forking: {
        enabled: true,
        blockNumber: FORKING_BLOCK_NUMBER ? parseInt(FORKING_BLOCK_NUMBER, 10) : undefined,
        url: 'https://flashy-fittest-lambo.bsc.discover.quiknode.pro/72b200feabb7787e65699c8a082aa27ac59ddcf2/',
      },
      deploy: ['deploy/evm'],
    };
    break;

  case ETH:
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
          privateKey: getPrivteKeys().length
            ? getPrivteKeys()[0]
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
      chainId: forkingChainId(),
      accounts: getPrivteKeys(LOCALHOST),
      live: false,
      saveDeployments: true,
      deploy: ['deploy/evm'],
    },
    avalanche_staging: {
      url: getProviderData(AVALANCHE_STAGING).url,
      accounts: getPrivteKeys(LOCALHOST),
      chainId: getProviderData(AVALANCHE_STAGING).chainId,
    },
    bnb_staging: {
      url: getProviderData(BNB_STAGING).url,
      accounts: getPrivteKeys(LOCALHOST),
      chainId: getProviderData(BNB_STAGING).chainId,
      gasPrice: gwei(10)
    },
    ethereum_staging: {
      url: getProviderData(ETH_STAGING).url,
      accounts: getPrivteKeys(LOCALHOST),
      chainId: getProviderData(ETH_STAGING).chainId,
      gasPrice: 'auto'
    },
    polygon_staging: {
      url: getProviderData(POLYGON_STAGING).url,
      accounts: getPrivteKeys(LOCALHOST),
      chainId: getProviderData(POLYGON_STAGING).chainId,
      gasPrice: 'auto',
      gasMultiplier: 2
    },
    arbitrum_staging: {
      url: getProviderData(ARBITRUM_STAGING).url,
      accounts: getPrivteKeys(LOCALHOST),
      chainId: getProviderData(ARBITRUM_STAGING).chainId,
      gasPrice: 'auto'
    },
    arbitrum_sandbox: {
      url: getProviderData(ARBITRUM_SANDBOX).url,
      accounts: getPrivteKeys(LOCALHOST),
      chainId: getProviderData(ARBITRUM_SANDBOX).chainId,
      gasPrice: 'auto'
    },
    avalanche_sandbox: {
      url: getProviderData(AVALANCHE_SANDBOX).url,
      accounts: getPrivteKeys(LOCALHOST),
      chainId: getProviderData(AVALANCHE_SANDBOX).chainId,
      gasPrice: gwei(25)
    },
    polygon_sandbox: {
      url: getProviderData(POLYGON_SANDBOX).url,
      accounts: getPrivteKeys(LOCALHOST),
      chainId: getProviderData(POLYGON_SANDBOX).chainId,
      gasPrice: 'auto',
      gasMultiplier: 2
    },
    ethereum_sandbox: {
      url: getProviderData(ETH_SANDBOX).url,
      accounts: getPrivteKeys(LOCALHOST),
      chainId: getProviderData(ETH_SANDBOX).chainId,
      gasPrice: 'auto'
    },
    bnb_sandbox: {
      url: getProviderData(BNB_SANDBOX).url,
      accounts: getPrivteKeys(LOCALHOST),
      chainId: getProviderData(BNB_SANDBOX).chainId,
      gasPrice: gwei(10)
    },
    arbitrum_production: {
      url: getProviderData(ARBITRUM_PRODUCTION).url,
      accounts: getPrivteKeys(PROD_PK),
      chainId: getProviderData(ARBITRUM_PRODUCTION).chainId,
      gasPrice: 'auto',
    },
    avalanche_production: {
      url: getProviderData(AVALANCHE_PRODUCTION).url,
      accounts: getPrivteKeys(PROD_PK),
      chainId: getProviderData(AVALANCHE_PRODUCTION).chainId,
      gasPrice: 'auto',
    },
    eth_production: {
      url: getProviderData(ETH_PRODUCTION).url,
      accounts: getPrivteKeys(PROD_PK),
      chainId: getProviderData(ETH_PRODUCTION).chainId,
      live: true,
      gasPrice: 'auto',
      gasMultiplier: 1.5
    },
    bnb_production: {
      url: getProviderData(BNB_PRODUCTION).url,
      accounts: getPrivteKeys(PROD_PK),
      chainId: getProviderData(BNB_PRODUCTION).chainId,
      gasPrice: gwei(5),
      live: true
    },
    polygon_production: {
      url: getProviderData(POLYGON_PRODUCTION).url,
      accounts: getPrivteKeys(PROD_PK),
      chainId: getProviderData(POLYGON_PRODUCTION).chainId,
      live: true,
      gasMultiplier: 2,
      blockGasLimit: 40_000_000,
    },
    docker: {
      url: 'http://eth:8545',
    },
  },
  mocha: {
    timeout: 80000,
    grep: `@${CHAIN_ID ? 'foreignchain' : ''}`,
    invert: !CHAIN_ID,
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://bscscan.com/
    apiKey: apiKey()
  },
  gasReporter: {
    gasPrice: 1,
    currency: 'USD',
    enabled: !!process.env.REPORT_GAS,
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
