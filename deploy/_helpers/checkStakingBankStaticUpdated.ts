import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { REGISTRY, STAKING_BANK, STAKING_BANK_STATIC } from '../../constants';

export async function checkStakingBankStaticUpdated(hre: HardhatRuntimeEnvironment): Promise<boolean> {
  const { address: stakingBankAddress } = await hre.deployments.get(STAKING_BANK_STATIC);
  const registeredBank = await hre.deployments.read(REGISTRY, 'getAddressByString', STAKING_BANK);

  if (registeredBank.toLowerCase() !== stakingBankAddress.toLowerCase()) {
    console.warn('!'.repeat(80));
    console.log({ stakingBankAddress, registeredBank });
    console.warn('bank in registry is different than deployed one, register bank first before deployment of chain');
    console.warn('run:');
    console.warn('npx hardhat registerStakingBankStatic --network', hre.network.name);
    console.warn('!'.repeat(80));
    return false;
  }

  return true;
}
