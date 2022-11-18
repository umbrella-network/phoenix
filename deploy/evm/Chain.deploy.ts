import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { CHAIN, ChainType, FOREIGN_CHAIN, REGISTRY, STAKING_BANK, STAKING_BANK_STATE } from '../../constants';
import { resolveChainName } from '../../tasks/_helpers/resolveChainName';
import { deployChains } from '../_helpers/deployChains';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const chainId = parseInt(await hre.getChainId(), 10);
  const chainName: ChainType = resolveChainName(chainId);

  await deployChains(hre, chainId, chainName);
};

func.dependencies = [REGISTRY, STAKING_BANK, STAKING_BANK_STATE];
func.tags = [CHAIN, FOREIGN_CHAIN];
export default func;
