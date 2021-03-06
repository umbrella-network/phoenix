export type Config = {
  contractRegistry: {
    address: string
  },
  token: {
    totalSupply: string,
    name: string,
    symbol: string
  },
  chain: {
    blockPadding: number
  },
  validators: [
    {
      location: string
    }
  ]
};