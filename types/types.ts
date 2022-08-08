export enum ChainContractNames {
  Chain = 'Chain',
  ForeignChain = 'ForeignChain',
}

export type SubmitPreparedData = {
  testimony: string;
  affidavit: Uint8Array;
  sig: string;
  r: string;
  s: string;
  v: number;
  hashForSolidity: string;
  dataTimestamp: number;
}
