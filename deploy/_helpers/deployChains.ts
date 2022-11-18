import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ChainType } from '../../constants';
import { isMasterChain } from '../../constants/networks';
import { chainDeploymentData } from '../deploymentsData';
import { verifyCode } from '../../scripts/utils/verifyContract';
import { BaseChain } from '../../typechain';

export const deployChains = async (hre: HardhatRuntimeEnvironment, chainId: number, chainName: ChainType) => {
  const { deploy, read } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  const onMasterChain = isMasterChain(chainId);

  console.log(`Deploying ${chainName} on ${onMasterChain ? 'MASTER' : 'FOREIGN'} chain: ${hre.network.name}`);

  const data = await chainDeploymentData(hre);
  console.log({ data, deployer });
  const chain = await deploy(chainName, { from: deployer, log: true, args: data.args, waitConfirmations: 1 });
  await verifyCode(hre, chain.address, data.args);

  const consensusData: BaseChain.ConsensusDataStruct = await read(chainName, 'getConsensusData');

  if (consensusData.deprecated) {
    throw new Error(`${chainName} (${chain.address}) is deprecated. Remove deployment file and run task again`);
  }
};
