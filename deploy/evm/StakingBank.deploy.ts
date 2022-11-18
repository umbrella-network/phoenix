import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { STAKING_BANK, REGISTRY, ERC20 } from '../../constants';
import { stakingBankDeploymentData } from '../deploymentsData';
import { isMasterChain } from '../../constants/networks';
import { verifyCode } from '../../scripts/utils/verifyContract';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute, read } = deployments;
  const { deployer } = await getNamedAccounts();

  if (!isMasterChain(await hre.getChainId())) {
    console.log(`contract ${STAKING_BANK} can NOT be deployed on ${hre.network.name} (not master chain)`);
    return;
  }

  const inRegistry = await read(REGISTRY, 'getAddressByString', STAKING_BANK);

  if (inRegistry != hre.ethers.constants.AddressZero) {
    console.log(`contract ${STAKING_BANK} already deployed at ${inRegistry}`);
    return;
  }

  const data = await stakingBankDeploymentData(hre);
  const stakingBank = await deploy(STAKING_BANK, { from: deployer, log: true, args: data.args, waitConfirmations: 1 });
  await verifyCode(hre, stakingBank.address, data.args);

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
};

func.dependencies = [REGISTRY, ERC20];
func.tags = [STAKING_BANK];
export default func;
