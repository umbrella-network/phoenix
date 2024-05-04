import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { QUOTERV2 } from '../../constants';
import { verifyCode } from '../../scripts/utils/verifyContract';
import { ETH_PRODUCTION, ETH_SEPOLIA, HARDHAT } from '../../constants/networks';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  console.log(`Deploying ${QUOTERV2} on chain: ${hre.network.name}`);

  let uniswapV3Factory = '';
  let weth = '';

  switch (hre.network.name) {
    case HARDHAT:
    case ETH_PRODUCTION:
      uniswapV3Factory = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
      weth = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
      break;

    case ETH_SEPOLIA:
      uniswapV3Factory = '0x0227628f3F023bb0B980b67D528571c95c6DaC1c';
      weth = '0xD0dF82dE051244f04BfF3A8bB1f62E1cD39eED92';
      break;

    default: throw new Error(`${QUOTERV2} not set up for ${hre.network.name}`);
  }

  const args = [uniswapV3Factory, weth];
  console.log(`[${hre.network.name}] ${QUOTERV2} args: ${args}`);

  const chain = await deploy(QUOTERV2, { from: deployer, log: true, args, waitConfirmations: 1 });
  await verifyCode(hre, chain.address, args);
};

func.tags = [QUOTERV2];
export default func;
