import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { HttpNetworkConfig } from 'hardhat/src/types/config';
import { ethers } from 'ethers';
import { getPrivateKeys } from '../../constants/pk';

const jsonRpcProvider = (hre: HardhatRuntimeEnvironment): ethers.providers.JsonRpcProvider => {
  const rpcUrl = (hre.config.networks[hre.network.name] as HttpNetworkConfig).url;
  return rpcUrl ? new ethers.providers.JsonRpcProvider(rpcUrl) : hre.ethers.provider;
};

export const deployerSigner = (hre: HardhatRuntimeEnvironment): ethers.Wallet => {
  return new ethers.Wallet(getPrivateKeys(hre.network.name)[0], jsonRpcProvider(hre));
};
