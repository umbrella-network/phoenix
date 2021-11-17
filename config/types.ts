export interface ValidatorConfig {
  location: string;
  privateKey: string;
}

export interface Config {
  distributor?: {
    address: string
  },
  contractRegistry: {
    address: string
  },
  token: {
    address?: string
    totalSupply: string,
    name: string,
    symbol: string
  },
  chain: {
    padding: number
    requiredSignatures: number
    replicator?: string
  },
  stakingBank: {
    minAmountForStake: bigint
  }
  validators: ValidatorConfig[],
}

export interface ForeignConfig {
  distributor?: {
    address: string
  },
  contractRegistry: {
    address: string
  },
  chain: {
    padding: number
    requiredSignatures: number
    replicator: string
  },
}

export interface GlobalConfig {
  bsc: Config,
  ethereum: ForeignConfig,
  polygon: ForeignConfig,
  avalanche: ForeignConfig,
}
