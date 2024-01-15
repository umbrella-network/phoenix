import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { REGISTRY, STAKING_BANK, STAKING_BANK_STATIC } from '../../constants';
import { verifyCode } from '../../scripts/utils/verifyContract';
import { stakingBankStaticDeploymentData } from '../deploymentsData/stakingBankStatic';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, read, execute } = deployments;
  const { deployer } = await getNamedAccounts();

  const { args, contractName } = await stakingBankStaticDeploymentData(hre);

  const stakingBank = await deploy(STAKING_BANK_STATIC, {
    contract: contractName,
    from: deployer,
    log: true,
    args,
    waitConfirmations: 1,
  });

  const inRegistry = await read(REGISTRY, 'getAddressByString', STAKING_BANK);

  if (inRegistry === hre.ethers.constants.AddressZero) {
    console.log(`registering new ${STAKING_BANK_STATIC} (${contractName})`);

    await execute(
      REGISTRY,
      {
        from: deployer,
        log: true,
        waitConfirmations: 1,
      },
      'importContracts',
      [stakingBank.address],
    );
  }

  await verifyCode(hre, stakingBank.address, args);
};

func.dependencies = [REGISTRY];
func.tags = [STAKING_BANK_STATIC];
export default func;
