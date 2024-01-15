import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { deployerSigner } from './jsonRpcProvider';
import { CHAIN, FOREIGN_CHAIN, REGISTRY } from '../../constants';
import { BaseChain, Registry__factory } from '../../typechain';
import { resolveChainName } from './resolveChainName';
import { Contract, ethers } from 'ethers';
import { isMasterChain } from '../../constants/networks';
import { ChainStatus } from '../../test/types/ChainStatus';
import { confirmations } from './confirmations';

const { AddressZero } = ethers.constants;

const verifyChainRegistration = async (
  hre: HardhatRuntimeEnvironment,
  oldChainAddress: string,
  newChainAddress: string,
) => {
  const onMasterChain = isMasterChain(await hre.getChainId());
  const CHAIN_NAME = onMasterChain ? CHAIN : FOREIGN_CHAIN;
  const OLD_NAME = onMasterChain ? CHAIN_NAME : 'IBaseChainV1';

  console.log(`verify ${CHAIN_NAME} Deployment`, '_'.repeat(30));
  console.log({ oldChainAddress, newChainAddress });

  if (oldChainAddress == newChainAddress) {
    oldChainAddress = AddressZero;
  }

  const oldChainArtifacts = await hre.artifacts.readArtifact(OLD_NAME);
  const newChainArtifacts = await hre.artifacts.readArtifact(CHAIN_NAME);
  const oldExists = oldChainAddress != AddressZero;

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

export const registerChain = async (hre: HardhatRuntimeEnvironment) => {
  const { read } = hre.deployments;
  const deployer = deployerSigner(hre);

  const registryDeployments = await hre.deployments.get(REGISTRY);

  const registry = Registry__factory.connect(registryDeployments.address, deployer);

  const registryOwner = await registry.owner();
  const chainId = parseInt(await hre.getChainId(), 10);
  const CHAIN_NAME = resolveChainName(chainId);
  const chain = await hre.deployments.get(CHAIN_NAME);

  if (registryOwner.toLowerCase() != deployer.address.toLowerCase()) {
    console.log('!'.repeat(80));
    console.log(`importing ${CHAIN_NAME} address to registry not possible - not an owner`);
    console.log('if there is multisig setup, please analyse `registerChain` task and execute necessary tx');
    console.log('or add support for sending tx to multisig');
    console.log('!'.repeat(80));
    console.log({ registryOwner, deployer: deployer.address });
    return;
  }

  const inRegistry = await registry.getAddressByString(CHAIN);
  console.log({ inRegistry, deployed: chain.address });

  if (inRegistry.toLowerCase() != chain.address.toLowerCase()) {
    console.log(`current ${CHAIN_NAME}: ${inRegistry}`);

    const importContracts = 'importContracts';
    const atomicUpdate = 'atomicUpdate';

    const method = inRegistry == AddressZero ? importContracts : atomicUpdate;
    const args = inRegistry == AddressZero ? [chain.address] : chain.address;

    console.log('importing new chain address to registry using:', method);

    const registryIface = new ethers.utils.Interface(registryDeployments.abi);

    const nonce = await deployer.getTransactionCount('latest');
    console.log({ nonce, from: deployer.address });

    try {
      await deployer.sendTransaction({
        to: registry.address,
        value: 0,
        data: registryIface.encodeFunctionData(method, [args]),
        gasPrice: hre.network.config.gasPrice == 'auto' ? undefined : hre.network.config.gasPrice,
        nonce,
      });
    } catch (e) {
      if (atomicUpdate != method) {
        throw e;
      }

      if ((e as Error).message.includes('transaction underpriced')) {
        throw e;
      }

      if ((e as Error).message.includes('cannot estimate gas')) {
        throw e;
      }

      console.log((e as Error).message);
      console.log(`\n\n${atomicUpdate} failed, trying old way "${importContracts}"`);

      const nonce = await hre.ethers.provider.getTransactionCount(deployer.address);
      const chainInterface = new ethers.utils.Interface(chain.abi);

      // do not await, we want to queue tx

      const registerTx = deployer.sendTransaction({
        to: chain.address,
        value: 0,
        nonce,
        data: chainInterface.encodeFunctionData('register', []),
        gasPrice: hre.network.config.gasPrice == 'auto' ? undefined : hre.network.config.gasPrice,
      });

      const importContractsTx = deployer.sendTransaction({
        to: registryDeployments.address,
        value: 0,
        nonce: nonce + 1,
        data: registryIface.encodeFunctionData(importContracts, [[chain.address]]),
        gasPrice: hre.network.config.gasPrice == 'auto' ? undefined : hre.network.config.gasPrice,
      });

      console.log(`unregistering old chain: ${inRegistry}`);

      const unregisterTx = deployer.sendTransaction({
        to: inRegistry,
        nonce: nonce + 2,
        data: hre.ethers.utils.id('unregister()').slice(0, 10),
        gasPrice: hre.network.config.gasPrice == 'auto' ? undefined : hre.network.config.gasPrice,
      });

      const txs = await Promise.all([registerTx, importContractsTx, unregisterTx]);
      console.log(txs.map((tx) => tx.hash));
      console.log('waiting for confirmation...');
      await Promise.all(txs.map((tx) => tx.wait(confirmations(hre.network.name))));
    }
  } else {
    console.log(`${CHAIN_NAME} already registered`, inRegistry);

    const consensusData: BaseChain.ConsensusDataStruct = await read(CHAIN_NAME, 'getConsensusData');
    console.log({ consensusData });
  }

  await verifyChainRegistration(hre, inRegistry, chain.address);
};
