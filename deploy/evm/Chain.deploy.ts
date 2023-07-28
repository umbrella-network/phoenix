import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { CHAIN, ChainType, FOREIGN_CHAIN, REGISTRY, STAKING_BANK_STATIC } from '../../constants';
import { resolveChainName } from '../../tasks/_helpers/resolveChainName';
import { deployChains } from '../_helpers/deployChains';
import { checkStakingBankStaticUpdated } from '../_helpers/checkStakingBankStaticUpdated';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (hre.network.name.includes('linea')) {
    console.log('-'.repeat(80));
    console.log(`chain is not supported on ${hre.network.name}`);
    console.log('-'.repeat(80));
    return;
  }

  const chainId = parseInt(await hre.getChainId(), 10);
  const chainName: ChainType = resolveChainName(chainId);

  // check if we are using newest staking bank
  if (!(await checkStakingBankStaticUpdated(hre))) {
    return;
  }

  await deployChains(hre, chainId, chainName);
};

func.dependencies = [REGISTRY, STAKING_BANK_STATIC];
func.tags = [CHAIN, FOREIGN_CHAIN];
export default func;
