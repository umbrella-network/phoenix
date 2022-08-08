import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Contract } from 'ethers';
import { CHAIN, CHAIN_BYTES32 } from '../../constants';
import { ChainContractNames } from '../../types/types';

export const ensureCanRegisterChain = async (
  hre: HardhatRuntimeEnvironment,
  registry: Contract,
  chainName: ChainContractNames
): Promise<boolean> => {
  console.log('ensureCanRegisterChain', chainName);

  const { ethers, artifacts } = hre;

  const chainArtifacts = await artifacts.readArtifactSync(CHAIN);
  console.log(CHAIN_BYTES32);
  const currentChainAddress = await registry.getAddress(CHAIN_BYTES32);
  let isForeign = false;

  if (currentChainAddress === ethers.constants.AddressZero) {
    console.log(`${chainName} is not deployed`);
    return true;
  }

  console.log(`currentChainAddress ${currentChainAddress}`);

  const currentChain = new ethers.Contract(currentChainAddress, chainArtifacts.abi, hre.ethers.provider);

  try {
    isForeign = await currentChain.isForeign();
  } catch (e) {
    console.log(e);
    console.log('if chain throw,then it is "old" regular chain');
  }

  console.log({ isForeign, chainName });

  if (
    (!isForeign && chainName === ChainContractNames.ForeignChain) ||
    (isForeign && chainName !== ChainContractNames.ForeignChain)
  ) {
    throw Error(
      `One type of chain allowed per setup, isForeign: ${isForeign} in conflict with chainName: ${chainName}`
    );
  }

  return isForeign;
};
