import { task } from 'hardhat/config';
import { Contract } from 'ethers';
import { boolean } from 'hardhat/internal/core/params/argumentTypes';

import { CHAIN, CHAIN_BYTES32, REGISTRY } from '../constants';
import { chainDeploymentData } from '../deploy/deploymentsData';
import { resolveRegistry } from './_helpers/resolveRegistry';
import { ensureCanRegisterChain } from './_helpers/ensureCanRegisterChain';
import { ChainContractNames } from '../types/types';
import { verifyCode } from '../scripts/utils/verifyContract';

// this script is needed because we do not have deployments for Registry
// If we can figure out how to create deployments data for existing contracts
// we can simplify and use regular deploy task, and only register contract using this script
task('redeploy-homechain', 'Homechain (re)deployment')
  .addParam('forcedeploy', 'do deploy even if nothing changed', false, boolean)
  .setAction(async (taskArgs, hre) => {
    const env = hre.network.name.split('_')[1];
    require('custom-env').env(env); // eslint-disable-line
    console.log({ taskArgs });
    console.log(`NETWORK: ${hre.network.name} (${(await hre.ethers.provider.getNetwork()).chainId})`);
    const { deployments, artifacts } = hre;
    const [deployerSigner] = await hre.ethers.getSigners();

    // const registryDeployments = await hre.deployments.get(REGISTRY);
    // const registry = new ethers.Contract(registryDeployments.address, registryDeployments.abi, hre.ethers.provider);
    const registry = await resolveRegistry(hre);

    const chainArtifacts = artifacts.readArtifactSync(CHAIN);
    const oldChainAddress = await registry.getAddress(CHAIN_BYTES32);
    const oldChain = new Contract(oldChainAddress, chainArtifacts.abi, deployerSigner);

    console.log(`${REGISTRY} ${registry.address}`);

    const isForeign = await ensureCanRegisterChain(hre, registry, ChainContractNames.Chain);
    if (isForeign) throw Error(`something is wrong, ${CHAIN} should not be foreign`);

    const data = await chainDeploymentData(hre);
    console.log({ data });

    const chain = await deployments.deploy(CHAIN, {
      log: true,
      from: deployerSigner.address,
      waitConfirmations: 1,
      args: data.args,
      // this option does not work like it should, remove redeployment file to redeploy same contract
      skipIfAlreadyDeployed: !taskArgs.forcedeploy,
      autoMine: true,
    });

    console.log('old chain address:', oldChainAddress);
    console.log('new chain address:', chain.address);
    console.log(taskArgs.forcedeploy);

    if (taskArgs.forcedeploy && oldChainAddress == chain.address) {
      throw Error('force deployment did not happen, chain not re-deployed');
    }

    const newChain = new Contract(chain.address, chainArtifacts.abi, deployerSigner);

    console.log('registering new chain manually...');
    const registerTx = newChain.register();

    console.log('importContracts(new chain)...');
    const importContractsTx = registry.connect(deployerSigner).importContracts([chain.address]);
    await Promise.all([(await registerTx).wait(1), (await importContractsTx).wait(1)]);
    console.log('done');

    // TODO once we have V2 in prod, we can use `.deprecate()` before `newChain.register();`
    const unregisterTx = await oldChain.unregister();

    console.log('waiting for confirmations...');
    await unregisterTx.wait(1);

    await verifyCode(hre, newChain.address, data.args);

    const consensusData = await newChain.getConsensusData();
    console.log({ consensusData });
  });
