import { BigNumber } from 'ethers';

export interface ChainStatus {
  blockNumber: BigNumber;
  timePadding: number;
  lastDataTimestamp: number;
  lastBlockId: number;
  nextLeader: string;
  nextBlockId: number;
  validators: string[];
  powers: BigNumber[];
  locations: string[];
  staked: BigNumber;
  minSignatures: number;
}

export interface ForeignChainStatus {
  blockNumber: BigNumber;
  timePadding: number;
  lastDataTimestamp: number;
  lastId: number;
  nextBlockId: number;
  minSignatures: number;
}
