import 'dotenv/config';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import 'hardhat-gas-reporter';
import '@nomiclabs/hardhat-solhint';
import 'solidity-coverage';
import '@matterlabs/hardhat-zksync-solc';
import '@matterlabs/hardhat-zksync-verify';

// there is undefined issue in this repo, ts-node is ignoring flag TS_NODE_TRANSPILE_ONLY=1 and throw errors
// on missing typechain/
if (!process.env.TS_NODE_TRANSPILE_ONLY) {
  require('./tasks');
}

import {HardhatNetworkForkingUserConfig, HardhatUserConfig} from 'hardhat/types';
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
  BASE_STAGING,
  BNB,
  BNB_PRODUCTION,
  BNB_SANDBOX,
  BNB_STAGING, BOB_PRODUCTION, BOB_STAGING,
  ETH,
  ETH_PRODUCTION,
  ETH_SANDBOX, ETH_SEPOLIA,
  ETH_STAGING,
  LINEA_PRODUCTION,
  LINEA_SANDBOX,
  LINEA_STAGING,
  LOCALHOST,
  MELD_SANDBOX,
  OKX_SANDBOX,
  POLYGON_PRODUCTION,
  POLYGON_SANDBOX,
  POLYGON_STAGING,
  ROOTSTOCK_PRODUCTION,
  ROOTSTOCK_SANDBOX, ROOTSTOCK_STAGING,
  XDC_SANDBOX, ZK_LINK_NOVA_PRODUCTION, ZK_LINK_NOVA_SANDBOX, ZK_LINK_NOVA_STAGING
} from './constants/networks';
import {getPrivateKeys, PROD_PK} from './constants/pk';
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
  LINEASCAN_API = '',
  BASESCAN_API = '',
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
    'sepolia': ETHERSCAN_API,
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
    'lineatestnet': LINEASCAN_API,
    'linea': LINEASCAN_API,
    'base-goerli': 'PLACEHOLDER_STRING',
    'base-mainnet': BASESCAN_API,
    'rootstock_production': 'any non empty string'
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
          privateKey: getPrivateKeys().length
            ? getPrivateKeys()[0]
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
      accounts: getPrivateKeys(LOCALHOST),
      live: false,
      saveDeployments: true,
      deploy: ['deploy/evm'],
    },
    linea_staging: {
      url: getProviderData(LINEA_STAGING).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(LINEA_STAGING).chainId,
    },
    base_staging: {
      url: getProviderData(BASE_STAGING).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(BASE_STAGING).chainId,
      gasMultiplier: 1.5
    },
    avalanche_staging: {
      url: getProviderData(AVALANCHE_STAGING).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(AVALANCHE_STAGING).chainId,
    },
    bnb_staging: {
      url: getProviderData(BNB_STAGING).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(BNB_STAGING).chainId,
      gasPrice: gwei(10)
    },
    ethereum_staging: {
      url: getProviderData(ETH_STAGING).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(ETH_STAGING).chainId,
      gasPrice: 'auto'
    },
    eth_sepolia: {
      url: getProviderData(ETH_SEPOLIA).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(ETH_SEPOLIA).chainId,
      gasPrice: 'auto'
    },
    polygon_staging: {
      url: getProviderData(POLYGON_STAGING).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(POLYGON_STAGING).chainId,
      gasPrice: 'auto',
      gasMultiplier: 2
    },
    arbitrum_staging: {
      url: getProviderData(ARBITRUM_STAGING).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(ARBITRUM_STAGING).chainId,
      gasPrice: 'auto'
    },
    bob_staging: {
      url: getProviderData(BOB_STAGING).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(BOB_STAGING).chainId,
      gasPrice: 'auto'
    },
    bob_sandbox: {
      url: getProviderData(BOB_STAGING).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(BOB_STAGING).chainId,
      gasPrice: 'auto'
    },
    bob_production: {
      url: getProviderData(BOB_PRODUCTION).url,
      accounts: getPrivateKeys(BOB_PRODUCTION),
      chainId: getProviderData(BOB_PRODUCTION).chainId,
      gasPrice: 'auto'
    },
    linea_sandbox: {
      url: getProviderData(LINEA_SANDBOX).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(LINEA_SANDBOX).chainId,
      gasPrice: 'auto'
    },
    arbitrum_sandbox: {
      url: getProviderData(ARBITRUM_SANDBOX).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(ARBITRUM_SANDBOX).chainId,
      gasPrice: 'auto'
    },
    avalanche_sandbox: {
      url: getProviderData(AVALANCHE_SANDBOX).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(AVALANCHE_SANDBOX).chainId,
      gasPrice: gwei(25)
    },
    polygon_sandbox: {
      url: getProviderData(POLYGON_SANDBOX).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(POLYGON_SANDBOX).chainId,
      gasPrice: 'auto',
      gasMultiplier: 2
    },
    ethereum_sandbox: {
      url: getProviderData(ETH_SANDBOX).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(ETH_SANDBOX).chainId,
      gasPrice: 'auto'
    },
    bnb_sandbox: {
      url: getProviderData(BNB_SANDBOX).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(BNB_SANDBOX).chainId,
      gasPrice: gwei(10)
    },
    xdc_sandbox: {
      url: getProviderData(XDC_SANDBOX).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(XDC_SANDBOX).chainId,
      gasPrice: 'auto'
    },
    okx_sandbox: {
      url: getProviderData(OKX_SANDBOX).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(OKX_SANDBOX).chainId,
      gasPrice: 'auto'
    },
    astar_sandbox: {
      url: getProviderData(ASTAR_SANDBOX).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(ASTAR_SANDBOX).chainId,
      gasPrice: 'auto'
    },
    arthera_sandbox: {
      url: getProviderData(ARTHERA_SANDBOX).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(ARTHERA_SANDBOX).chainId,
      gasPrice: 'auto'
    },
    meld_sandbox: {
      url: getProviderData(MELD_SANDBOX).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(MELD_SANDBOX).chainId,
      gasPrice: 'auto'
    },
    rootstock_sandbox: {
      url: getProviderData(ROOTSTOCK_SANDBOX).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(ROOTSTOCK_SANDBOX).chainId,
      gasPrice: 'auto'
    },
    rootstock_staging: {
      url: getProviderData(ROOTSTOCK_STAGING).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(ROOTSTOCK_STAGING).chainId,
      gasPrice: 'auto'
    },
    zk_link_nova_staging: {
      url: getProviderData(ZK_LINK_NOVA_STAGING).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(ZK_LINK_NOVA_STAGING).chainId,
      gasPrice: 'auto',
      ethNetwork: 'sepolia', // The Ethereum Web3 RPC URL, or the identifier of the network (e.g. `mainnet`, `sepolia`)
      // Verification endpoint for Sepolia
      verifyURL: 'https://explorer.sepolia.era.zksync.dev/contract_verification',
      zksync: true, // enables zksolc compiler
    },
    zk_link_nova_sandbox: {
      url: getProviderData(ZK_LINK_NOVA_SANDBOX).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(ZK_LINK_NOVA_SANDBOX).chainId,
      gasPrice: 'auto',
      ethNetwork: 'sepolia', // The Ethereum Web3 RPC URL, or the identifier of the network (e.g. `mainnet`, `sepolia`)
      // Verification endpoint for Sepolia
      verifyURL: 'https://explorer.sepolia.era.zksync.dev/contract_verification',
      zksync: true, // enables zksolc compiler
    },
    zk_link_nova_productin: {
      url: getProviderData(ZK_LINK_NOVA_PRODUCTION).url,
      accounts: getPrivateKeys(LOCALHOST),
      chainId: getProviderData(ZK_LINK_NOVA_PRODUCTION).chainId,
      gasPrice: 'auto',
      ethNetwork: 'mainnet', // The Ethereum Web3 RPC URL, or the identifier of the network (e.g. `mainnet`, `sepolia`)
      // Verification endpoint for Sepolia
      verifyURL: 'https://explorer.era.zksync.dev/contract_verification',
      zksync: true, // enables zksolc compiler
    },
    arbitrum_production: {
      url: getProviderData(ARBITRUM_PRODUCTION).url,
      accounts: getPrivateKeys(PROD_PK),
      chainId: getProviderData(ARBITRUM_PRODUCTION).chainId,
      gasPrice: 'auto',
    },
    avalanche_production: {
      url: getProviderData(AVALANCHE_PRODUCTION).url,
      accounts: getPrivateKeys(PROD_PK),
      chainId: getProviderData(AVALANCHE_PRODUCTION).chainId,
      gasPrice: 'auto',
    },
    eth_production: {
      url: getProviderData(ETH_PRODUCTION).url,
      accounts: getPrivateKeys(PROD_PK),
      chainId: getProviderData(ETH_PRODUCTION).chainId,
      live: true,
      gasPrice: 'auto',
      gasMultiplier: 1.5
    },
    bnb_production: {
      url: getProviderData(BNB_PRODUCTION).url,
      accounts: getPrivateKeys(PROD_PK),
      chainId: getProviderData(BNB_PRODUCTION).chainId,
      gasPrice: gwei(5),
      live: true
    },
    polygon_production: {
      url: getProviderData(POLYGON_PRODUCTION).url,
      accounts: getPrivateKeys(PROD_PK),
      chainId: getProviderData(POLYGON_PRODUCTION).chainId,
      live: true,
      gasMultiplier: 2,
      blockGasLimit: 40_000_000,
    },
    linea_production: {
      url: getProviderData(LINEA_PRODUCTION).url,
      accounts: getPrivateKeys(PROD_PK),
      chainId: getProviderData(LINEA_PRODUCTION).chainId,
      live: true
    },
    base_production: {
      url: getProviderData(BASE_PRODUCTION).url,
      accounts: getPrivateKeys(PROD_PK),
      chainId: getProviderData(BASE_PRODUCTION).chainId,
      live: true
    },
    rootstock_production: {
      url: getProviderData(ROOTSTOCK_PRODUCTION).url,
      accounts: getPrivateKeys(PROD_PK),
      chainId: getProviderData(ROOTSTOCK_PRODUCTION).chainId,
      live: true
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
    apiKey: apiKey(),
    customChains: [
      {
        network: 'lineatestnet',
        chainId: 59140,
        urls: {
          apiURL: 'https://api-testnet.lineascan.build/api',
          browserURL: 'https://goerli.lineascan.build'
        }
      },
      {
        network: 'linea',
        chainId: 59144,
        urls: {
          apiURL: 'https://api.lineascan.build/api',
          browserURL: 'https://lineascan.build/'
        }
      },
      {
        network: 'base-goerli',
        chainId: 84531,
        urls: {
          apiURL: 'https://api-goerli.basescan.org/api',
          browserURL: 'https://goerli.basescan.org'
        }
      },
      {
        network: 'base-mainnet',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.basescan.org/api',
          browserURL: 'https://basescan.org'
        }
      },
      {
        network: 'rootstock_sandbox',
        chainId: 31,
        urls: {
          apiURL: 'https://rootstock-testnet.blockscout.com/api/',
          browserURL: 'https://rootstock-testnet.blockscout.com/',
        }
      },
      {
        network: 'rootstock_production',
        chainId: 30,
        urls: {
          apiURL: 'https://rootstock.blockscout.com/api/',
          browserURL: 'https://rootstock.blockscout.com/',
        }
      },
    ]
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
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: false,
            runs: 0,
          },
        },
      }, {
        version: '0.8.13',
        settings: {
          optimizer: {
            enabled: false,
            runs: 0,
          },
        },
      }, {
        version: '0.8.22',
        settings: {
          optimizer: {
            enabled: false,
            runs: 0,
          },
        },
      }
    ],
    overrides: {
      '@uniswap/v3-core/contracts/libraries/FullMath.sol': {
        version: '0.7.6',
        settings: {},
      },
      '@uniswap/v3-core/contracts/libraries/TickBitmap.sol': {
        version: '0.7.6',
        settings: {},
      },
      'gitmodules/uniswap/v3-periphery/contracts/libraries/PoolAddress.sol': {
        version: '0.7.6',
        settings: {},
      },
      'gitmodules/uniswap/v3-periphery/contracts/libraries/PoolTicksCounter.sol': {
        version: '0.7.6',
        settings: {},
      },
      'gitmodules/uniswap/v3-periphery/contracts/lens/QuoterV2.sol': {
        version: '0.7.6',
        settings: {},
      },
    },
  },
  zksolc: {
    version: '1.4.0', // optional eg 'latest'
    settings: {
      // compilerPath: 'zksolc',  // optional. Can be used if compiler is located in a specific folder
      libraries:{}, // optional. References to non-inlinable libraries
      missingLibrariesPath: './.zksolc-libraries-cache/missingLibraryDependencies.json', // optional. cache
      isSystem: false, // optional.  Enables Yul instructions available only for zkSync system contracts and libraries
      forceEvmla: false, // optional. Falls back to EVM legacy assembly if there is a bug with Yul
      optimizer: {
        enabled: true, // optional. True by default
        mode: '3', // optional. 3 by default, z to optimize bytecode size
        // optional. Try to recompile with optimizer mode "z" if the bytecode is too large
        fallback_to_optimizing_for_size: false,
      },
      experimental: {
        dockerImage: '', // deprecated
        tag: ''   // deprecated
      },
      contractsToCompile: [
        'contracts/onChainFeeds/zk-link/UmbrellaFeeds.sol',

        'contracts/onChainFeeds/UmbrellaFeedsReader.sol',
        'contracts/onChainFeeds/UmbrellaFeedsReaderFactory.sol',

        'contracts/stakingBankStatic/StakingBankStatic.sol',
        'contracts/stakingBankStatic/StakingBankStaticDev.sol',
        'contracts/stakingBankStatic/StakingBankStaticLocal.sol',
        'contracts/stakingBankStatic/StakingBankStaticProd.sol',
        'contracts/stakingBankStatic/StakingBankStaticSbx.sol',
        'contracts/Registry.sol',
      ] //optional. Compile only specific contracts
    }
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
