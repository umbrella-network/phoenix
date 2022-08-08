import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { STAKING_BANK, REGISTRY, UMB, ERC20 } from '../../constants';
import { stakingBankDeploymentData } from '../deploymentsData';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute, read } = deployments;
  const { deployer } = await getNamedAccounts();

  const data = await stakingBankDeploymentData(hre);
  const stakingBank = await deploy(STAKING_BANK, { from: deployer, log: true, args: data.args, waitConfirmations: 1 });

  const uuuu = await read(REGISTRY, 'getAddressByString', UMB);
  const inRegistry = await read(REGISTRY, 'getAddressByString', STAKING_BANK);

  console.log({ uuuu });

  if (inRegistry != stakingBank.address) {
    await execute(
      REGISTRY,
      {
        from: deployer,
        log: true,
        waitConfirmations: 1,
      },
      'importContracts',
      [stakingBank.address]
    );
  }
};

func.dependencies = [REGISTRY, ERC20];
func.tags = [STAKING_BANK];
export default func;
