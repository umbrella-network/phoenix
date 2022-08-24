import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { STAKING_BANK, REGISTRY, STAKING_BANK_STATE } from '../../constants';
import { stakingBankStateDeploymentData } from '../deploymentsData/stakingBankState';
import { isMasterChain } from '../../constants/networks';
import { verifyCode } from '../../scripts/utils/verifyContract';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute, read } = deployments;
  const { deployer } = await getNamedAccounts();

  if (isMasterChain(await hre.getChainId())) {
    console.log(`contract ${STAKING_BANK_STATE} can NOT be deployed on ${hre.network.name} (master chain)`);
    return;
  }

  const inRegistry = await read(REGISTRY, 'getAddressByString', STAKING_BANK);

  if (inRegistry != hre.ethers.constants.AddressZero) {
    console.log(`contract ${STAKING_BANK_STATE} (${STAKING_BANK}) already deployed at ${inRegistry}`);
    return;
  }

  const data = await stakingBankStateDeploymentData(hre);

  const stakingBankState = await deploy(data.contractName, {
    from: deployer,
    log: true,
    args: data.args,
    waitConfirmations: 1,
  });

  await verifyCode(hre, stakingBankState.address, data.args);

  console.log(`stakingBankState registration: importContracts(${stakingBankState.address})`);

  await execute(
    REGISTRY,
    {
      from: deployer,
      log: true,
      waitConfirmations: 1,
    },
    'importContracts',
    [stakingBankState.address]
  );
};

func.dependencies = [REGISTRY];
func.tags = [STAKING_BANK_STATE];
export default func;
