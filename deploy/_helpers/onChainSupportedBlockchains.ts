import { HardhatRuntimeEnvironment } from 'hardhat/types';

export function onChainSupportedBlockchains(hre: HardhatRuntimeEnvironment): boolean {
  if (hre.network.name.includes('linea')) return true;
  if (hre.network.name.includes('polygon')) return true;
  if (hre.network.name.includes('base_')) return true;
  if (hre.network.name.includes('arbitrum_')) return true;

  return false;
}
