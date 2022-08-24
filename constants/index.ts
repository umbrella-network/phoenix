export * as networks from  './networks';

export const CHAIN = 'Chain';
export const CHAIN_BYTES32 = '0x436861696e000000000000000000000000000000000000000000000000000000';
export const ERC20 = 'ERC20';
export const FOREIGN_CHAIN = 'ForeignChain';
export const REGISTRY = 'Registry';
export const STAKING_BANK = 'StakingBank';
export const STAKING_BANK_STATE = 'StakingBankState';
export const UMB = 'UMB';
export const UMB_BYTES32 = '0x554d420000000000000000000000000000000000000000000000000000000000';

export type ChainType = typeof CHAIN | typeof  FOREIGN_CHAIN;