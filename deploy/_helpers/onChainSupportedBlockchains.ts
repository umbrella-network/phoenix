import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ROOTSTOCK_SANDBOX } from '../../constants/networks';

export function onChainSupportedBlockchains(hre: HardhatRuntimeEnvironment): boolean {
  if (hre.network.name.includes('linea')) return true;
  if (hre.network.name.includes('polygon')) return true;
  if (hre.network.name.includes('base_')) return true;
  if (hre.network.name.includes('arbitrum_')) return true;
  if (hre.network.name.includes('meld_sandbox')) return true;
  if (hre.network.name.includes('arthera_sandbox')) return true;
  if (hre.network.name.includes('xdc_sandbox')) return true;
  if (hre.network.name.includes('okx_sandbox')) return true;
  if (hre.network.name.includes('astar_sandbox')) return true;
  if (hre.network.name.includes(ROOTSTOCK_SANDBOX)) return true;

  return false;
}
