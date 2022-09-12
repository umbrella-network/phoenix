import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { CHAIN, ChainType, FOREIGN_CHAIN, REGISTRY, STAKING_BANK, STAKING_BANK_STATE } from '../../constants';
import { chainDeploymentData } from '../deploymentsData';
import { isMasterChain } from '../../constants/networks';
import { verifyCode } from '../../scripts/utils/verifyContract';
import { BaseChain } from '../../typechain';
import { Contract } from 'ethers';
import { ChainStatus } from '../../test/types/ChainStatus';

const verifyChainDeployment = async (
  hre: HardhatRuntimeEnvironment,
  oldChainAddress: string,
  newChainAddress: string
) => {
  const onMasterChain = isMasterChain(await hre.getChainId());
  const CHAIN_NAME = onMasterChain ? CHAIN : FOREIGN_CHAIN;
  const OLD_NAME = onMasterChain ? CHAIN_NAME : 'IBaseChainV1';

  console.log(`verify ${CHAIN_NAME} Deployment`, '_'.repeat(30));
  console.log({ oldChainAddress, newChainAddress });

  if (oldChainAddress == newChainAddress) {
    oldChainAddress = hre.ethers.constants.AddressZero;
  }

  const oldChainArtifacts = await hre.artifacts.readArtifact(OLD_NAME);
  const newChainArtifacts = await hre.artifacts.readArtifact(CHAIN_NAME);
  const oldExists = oldChainAddress != hre.ethers.constants.AddressZero;

  const oldChain = oldExists ? new Contract(oldChainAddress, oldChainArtifacts.abi, hre.ethers.provider) : undefined;
  const newChain = new Contract(newChainAddress, newChainArtifacts.abi, hre.ethers.provider);

  const oldStatus: ChainStatus | undefined = oldChain ? await oldChain.getStatus() : undefined;
  console.log({ oldStatus });
  const newStatus: ChainStatus = await newChain.getStatus();
  console.log({ newStatus });

  console.log(`lastDataTimestamp ${oldStatus?.lastDataTimestamp} vs ${newStatus.lastDataTimestamp}`);
  console.log(`lastId ${oldStatus?.lastId} vs ${newStatus.lastId}`);
  console.log(`nextBlockId ${oldStatus?.nextBlockId} vs ${newStatus.nextBlockId}`);

  const [blocksCountOffset, blocksCount] = await Promise.all([
    hre.deployments.read(CHAIN_NAME, 'blocksCountOffset'),
    hre.deployments.read(CHAIN_NAME, 'blocksCount'),
  ]);

  console.log(`blocksCountOffset ${blocksCountOffset}`);
  console.log(`blocksCount ${blocksCount}`);

  const inRegistry = await hre.deployments.read(REGISTRY, 'getAddressByString', CHAIN);

  if (inRegistry != newChainAddress) throw new Error('new contract is not in registry');

  if (oldStatus) {
    if (oldStatus?.nextBlockId + 1 != blocksCountOffset && oldStatus?.nextBlockId + 2 != blocksCountOffset) {
      throw new Error('invalid blocksCountOffset');
    }
  }

  if (blocksCount != 0) throw new Error('invalid blocksCount');

  console.log('_'.repeat(30));
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, read, execute } = deployments;
  const { deployer } = await getNamedAccounts();

  const onMasterChain = isMasterChain(await hre.getChainId());
  const CHAIN_NAME: ChainType = onMasterChain ? CHAIN : FOREIGN_CHAIN;

  console.log(`Deploying ${CHAIN_NAME} on ${onMasterChain ? 'MASTER' : 'FOREIGN'} chain: ${hre.network.name}`);

  const data = await chainDeploymentData(hre);
  console.log({ data, deployer });
  const chain = await deploy(CHAIN_NAME, { from: deployer, log: true, args: data.args, waitConfirmations: 1 });
  await verifyCode(hre, chain.address, data.args);

  const consensusData: BaseChain.ConsensusDataStruct = await read(CHAIN_NAME, 'getConsensusData');

  if (consensusData.deprecated) {
    throw new Error(`${CHAIN_NAME} (${chain.address}) is deprecated. Remove deployment file and run task again`);
  }

  const registryOwner = await read(REGISTRY, 'owner');

  if (registryOwner.toLowerCase() != deployer.toLowerCase()) {
    console.log('!'.repeat(80));
    console.log(`importing ${CHAIN_NAME} address to registry not possible - not an owner`);
    console.log('if there is multisig setup, please analyse `Chain.deploy` script and execute necessary tx');
    console.log('or add support for sending tx to multisig');
    console.log('!'.repeat(80));
    return;
  }

  const inRegistry = await read(REGISTRY, 'getAddressByString', CHAIN);

  if (inRegistry != chain.address) {
    console.log(`current ${CHAIN_NAME}: ${inRegistry}`);

    const importContracts = 'importContracts';
    const atomicUpdate = 'atomicUpdate';

    const method = inRegistry == hre.ethers.constants.AddressZero ? importContracts : atomicUpdate;
    const args = inRegistry == hre.ethers.constants.AddressZero ? [chain.address] : chain.address;

    console.log('importing new chain address to registry using:', method);

    try {
      await execute(
        REGISTRY,
        {
          from: deployer,
          log: true,
          waitConfirmations: 1,
        },
        method,
        args
      );
    } catch (e) {
      if (atomicUpdate != method) {
        throw e;
      }

      console.log(`${atomicUpdate} failed, trying old way "${importContracts}"`);

      const nonce = await hre.ethers.provider.getTransactionCount(deployer);

      const signer = await hre.ethers.getSigner(deployer);

      // do not await, we want to queue tx

      const registerTx = execute(
        CHAIN_NAME,
        {
          from: deployer,
          log: true,
          waitConfirmations: 1,
          nonce: nonce,
        },
        'register'
      );

      const importContractsTx = execute(
        REGISTRY,
        {
          from: deployer,
          log: true,
          waitConfirmations: 1,
          nonce: nonce + 1,
        },
        importContracts,
        [chain.address]
      );

      console.log(`unregistering old chain: ${inRegistry}`);

      const unregisterTx = signer.sendTransaction({
        to: inRegistry,
        nonce: nonce + 2,
        data: hre.ethers.utils.id('unregister()').slice(0, 10),
      });

      await Promise.all([registerTx, importContractsTx, (await unregisterTx).wait(1)]);
    }
  } else {
    console.log(`${CHAIN_NAME} already registered`);

    const consensusData: BaseChain.ConsensusDataStruct = await read(CHAIN_NAME, 'getConsensusData');
    console.log({ consensusData });
  }

  await verifyChainDeployment(hre, inRegistry, chain.address);
};

func.dependencies = [REGISTRY, STAKING_BANK, STAKING_BANK_STATE];
func.tags = [CHAIN, FOREIGN_CHAIN];
export default func;
