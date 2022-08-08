import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { networks, REGISTRY, UMB, UMB_BYTES32, ERC20 } from '../../constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy, execute, read } = deployments;
  const [deployer] = await hre.ethers.getSigners();

  let umbAddress: string;

  switch (hre.network.name) {
    case networks.LOCALHOST:
    case networks.HARDHAT:
      umbAddress = await read(REGISTRY, 'getAddressByString', UMB);
      console.log(`${UMB} address => ${umbAddress}`);

      if (umbAddress != hre.ethers.constants.AddressZero) {
        return;
      }

      break;

    default:
      throw Error(`missing UMB address for ${hre.network.name}`);
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
