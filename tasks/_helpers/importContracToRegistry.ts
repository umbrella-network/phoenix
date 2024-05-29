import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { deployerSigner } from './jsonRpcProvider';
import { REGISTRY } from '../../constants';
import { Registry__factory } from '../../typechain';
import { ContractTransaction } from 'ethers';
import { toBytes32 } from '../../scripts/utils/helpers';

export async function importContracToRegistry(
  hre: HardhatRuntimeEnvironment,
  contractToUpdate: string,
  updateFlag: boolean,
): Promise<[tx: ContractTransaction, address: string] | undefined> {
  const deployer = deployerSigner(hre);
  const registryDeployments = await hre.deployments.get(REGISTRY);
  const registry = Registry__factory.connect(registryDeployments.address, deployer);
  const registryOwner = await registry.owner();

  const contract = await hre.deployments.get(contractToUpdate);

  if (registryOwner.toLowerCase() != deployer.address.toLowerCase()) {
    console.log('!'.repeat(80));
    console.log(`importing ${contractToUpdate} address to registry not possible - not an owner`);
    console.log('!'.repeat(80));
    console.log({ registryOwner, deployer: deployer.address });
    return;
  }

  const inRegistry = await registry.getAddressByString(contractToUpdate);
  console.log({ inRegistry });
  console.log({ [contractToUpdate]: contract.address });

  if (inRegistry.toLowerCase() != contract.address.toLowerCase()) {
    const oldExists = inRegistry.toLowerCase() != hre.ethers.constants.AddressZero;

    if (oldExists && !updateFlag) {
      console.log('!'.repeat(80));
      console.log(`${contractToUpdate} already registered under ${inRegistry}, use --update flag to update`);
      console.log('!'.repeat(80));
      return;
    }

    const nonce = await deployer.getTransactionCount('latest');
    console.log({ nonce, from: deployer.address });

    return Promise.all([
      registry.importAddresses([toBytes32(contractToUpdate)], [contract.address], {
        nonce,
        gasPrice: hre.network.config.gasPrice == 'auto' ? undefined : hre.network.config.gasPrice,
      }),
      contract.address,
    ]);
  }
}
