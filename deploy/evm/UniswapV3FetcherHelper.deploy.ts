import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { QUOTERV2, UNISWAPV3_FETCHER_HELPER } from '../../constants';
import { verifyCode } from '../../scripts/utils/verifyContract';
import {ETH_PRODUCTION, ETH_SEPOLIA, HARDHAT, ROOTSTOCK_PRODUCTION} from '../../constants/networks';

function supportedBlockchain(hre: HardhatRuntimeEnvironment): boolean {
  if (hre.network.name.includes('hardhat')) return true;
  if (hre.network.name.includes('eth')) return true;
  if (hre.network.name.includes('rootstock_')) return true;

  return false;
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (!supportedBlockchain(hre)) {
    console.log('-'.repeat(80));
    console.log(`${UNISWAPV3_FETCHER_HELPER} is not supported on ${hre.network.name}`);
    console.log('-'.repeat(80));
    return;
  }

  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  console.log(`Deploying ${UNISWAPV3_FETCHER_HELPER} on chain: ${hre.network.name}`);

  // const quoter = await hre.deployments.get(QUOTERV2);
  let factory = '';
  let quoter = '';

  switch (hre.network.name) {
    case HARDHAT:
    case ETH_PRODUCTION:
      factory = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
      quoter = (await hre.deployments.get(QUOTERV2)).address;
      break;

    case ETH_SEPOLIA:
      factory = '0x0227628f3F023bb0B980b67D528571c95c6DaC1c';
      quoter = (await hre.deployments.get(QUOTERV2)).address;
      break;

    case ROOTSTOCK_PRODUCTION:
      // OKU https://docs.oku.trade/home/extra-information/deployed-contracts
      factory = '0xaF37EC98A00FD63689CF3060BF3B6784E00caD82';
      quoter = '0xb51727c996C68E60F598A923a5006853cd2fEB31';
      break;
  }

  if (!factory) throw new Error(`Uniswap Factory not setu up for ${hre.network.name}`);

  const args = [factory, quoter];

  const chain = await deploy(UNISWAPV3_FETCHER_HELPER, { from: deployer, log: true, args, waitConfirmations: 1 });
  await verifyCode(hre, chain.address, args);
};

func.dependencies = [QUOTERV2];
func.tags = [UNISWAPV3_FETCHER_HELPER];
export default func;
