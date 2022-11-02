import { isMasterChain } from '../../constants/networks';
import { CHAIN, ChainType, FOREIGN_CHAIN } from '../../constants';

export function resolveChainName(chainId: number): ChainType {
  const onMasterChain = isMasterChain(chainId);
  return onMasterChain ? CHAIN : FOREIGN_CHAIN;
}
