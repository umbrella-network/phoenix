export * as networks from './networks';

export const CHAIN = 'Chain';
export const CHAIN_BYTES32 = '0x436861696e000000000000000000000000000000000000000000000000000000';
export const ERC20 = 'ERC20';
export const FOREIGN_CHAIN = 'ForeignChain';
export const REGISTRY = 'Registry';
export const STAKING_BANK = 'StakingBank';
export const ISTAKING_BANK = 'IStakingBank';
export const STAKING_BANK_STATIC = 'StakingBankStatic';
export const STAKING_BANK_STATIC_LOCAL = 'StakingBankStaticLocal';
export const STAKING_BANK_STATIC_DEV = 'StakingBankStaticDev';
export const STAKING_BANK_STATIC_SBX = 'StakingBankStaticSbx';
export const STAKING_BANK_STATIC_PROD = 'StakingBankStaticProd';
export const STAKING_BANK_STATE = 'StakingBankState';
export const UMBRELLA_FEEDS = 'UmbrellaFeeds';
export const UMBRELLA_FEEDS_ARTIFACTS = 'contracts/onChainFeeds/UmbrellaFeeds.sol:UmbrellaFeeds';
export const UMBRELLA_FEEDS_READER_FACTORY = 'UmbrellaFeedsReaderFactory';
export const UMB = 'UMB';
export const UNISWAPV3_FETCHER_HELPER = 'UniswapV3FetcherHelper';
export const SOVRYN_FETCHER_HELPER = 'SovrynFetcherHelper';
export const QUOTERV2 = 'QuoterV2';
export const UMB_BYTES32 = '0x554d420000000000000000000000000000000000000000000000000000000000';

export type ChainType = typeof CHAIN | typeof FOREIGN_CHAIN;
