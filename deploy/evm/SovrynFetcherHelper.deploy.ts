import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { SOVRYN_FETCHER_HELPER } from '../../constants';
import { verifyCode } from '../../scripts/utils/verifyContract';
import { HARDHAT, ROOTSTOCK_PRODUCTION, ROOTSTOCK_SANDBOX } from '../../constants/networks';

function supportedBlockchain(hre: HardhatRuntimeEnvironment): boolean {
  if (hre.network.name.includes('hardhat')) return true;
  if (hre.network.name.includes('rootstock')) return true;

  return false;
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (!supportedBlockchain(hre)) {
    console.log('-'.repeat(80));
    console.log(`${SOVRYN_FETCHER_HELPER} is not supported on ${hre.network.name}`);
    console.log('-'.repeat(80));
    return;
  }

  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  console.log(`Deploying ${SOVRYN_FETCHER_HELPER} on chain: ${hre.network.name}`);

  let sovrynSwapNetworkAddress = '';

  switch (hre.network.name) {
    case HARDHAT:
    case ROOTSTOCK_PRODUCTION:
      sovrynSwapNetworkAddress = '0x98ace08d2b759a265ae326f010496bcd63c15afc';
      break;

    case ROOTSTOCK_SANDBOX:
      sovrynSwapNetworkAddress = '0x6390df6de9f24902b29740371525c2ceaa8f5a4f';
      break;

    default:
      throw new Error(`${SOVRYN_FETCHER_HELPER} missing setup for ${hre.network.name}`);
  }

  const args = [sovrynSwapNetworkAddress];
  console.log('deployment args:', hre.ethers.utils.defaultAbiCoder.encode(['address'], args));

  const chain = await deploy(SOVRYN_FETCHER_HELPER, { from: deployer, log: true, args, waitConfirmations: 1 });
  await verifyCode(hre, chain.address, args);
};

func.tags = [SOVRYN_FETCHER_HELPER];
export default func;
