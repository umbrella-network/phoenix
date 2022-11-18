import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { networks, REGISTRY, UMB, UMB_BYTES32, ERC20 } from '../../constants';
import { deployerSigner } from '../../tasks/_helpers/jsonRpcProvider';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy, execute, read } = deployments;
  const deployer = deployerSigner(hre);

  const umbAddress = await read(REGISTRY, 'getAddressByString', UMB);
  console.log(`${UMB} address => ${umbAddress}`);

  if (umbAddress != hre.ethers.constants.AddressZero) {
    return;
  }

  switch (hre.network.name) {
    case networks.LOCALHOST:
    case networks.HARDHAT:
      // we will deploy mock UMB
      break;

    default:
      console.log(`missing UMB address for ${hre.network.name}, probably not deployed on that network.`);
      return;
  }

  const erc20 = await deploy('ERC20', {
    from: deployer.address,
    log: true,
    waitConfirmations: 1,
    args: ['Umbrella', 'UMB'],
  });

  await execute(
    REGISTRY,
    {
      from: deployer.address,
      log: true,
      waitConfirmations: 1,
    },
    'importAddresses',
    [UMB_BYTES32],
    [erc20.address]
  );
};

func.tags = [ERC20];
func.dependencies = [REGISTRY];
export default func;
