import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ETH_SEPOLIA } from '../../constants/networks';

export function supportedLayer2Blockchain(hre: HardhatRuntimeEnvironment): boolean {
  if (hre.network.name == ETH_SEPOLIA) return false;

  if (hre.network.name.includes('hardhat')) return true;
  if (hre.network.name.includes('polygon')) return true;
  if (hre.network.name.includes('eth')) return true;
  if (hre.network.name.includes('arbitrum')) return true;
  if (hre.network.name.includes('avalanche')) return true;
  if (hre.network.name.includes('bnb')) return true;

  return false;
}
