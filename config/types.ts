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
    demo: boolean
  },
  stakingBank: {
    minAmountForStake: bigint
  }
  validators: ValidatorConfig[],
}

export interface GlobalConfig {
  ethereum: Config,
  smartchain: Config,
}
