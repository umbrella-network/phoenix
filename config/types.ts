export interface ValidatorConfig {
  location: string;
  privateKey: string;
}

export interface Config {
  contractRegistry: {
    address: string
  },
  token: {
    totalSupply: string,
    name: string,
    symbol: string
  },
  chain: {
    padding: number
  },
  validators: ValidatorConfig[],
}

export interface GlobalConfig {
  ethereum: Config,
  smartchain: Config,
}
