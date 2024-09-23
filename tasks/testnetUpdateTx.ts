import { task } from 'hardhat/config';
import { ethers } from 'ethers';

import { UMBRELLA_FEEDS } from '../constants';
import { UmbrellaFeeds__factory } from '../typechain';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeviationSigner } from '../test/utils/DeviationSigner';
import { deployerSigner } from './_helpers/jsonRpcProvider';

/*
npx hardhat testnetUpdateTx --network bnb_staging
 */
task('testnetUpdateTx', 'testnet update tx').setAction(async (hre: HardhatRuntimeEnvironment) => {
  const deviationSigner = new DeviationSigner();
  const deployer = deployerSigner(hre);

  const umbrellaFeedsDeployments = await hre.deployments.get(UMBRELLA_FEEDS);
  const umbrellaFeeds = UmbrellaFeeds__factory.connect(umbrellaFeedsDeployments.address, deployer);
  const networkId = (await hre.ethers.provider.getNetwork()).chainId;

  const t = Math.trunc(Date.now() / 1000);

  const data = {
    'TEST-NET': {
      data: 0,
      price: t,
      timestamp: t,
      heartbeat: 1,
    },
  };

  const keys = Object.keys(data).map((k) => ethers.utils.id(k));

  const validator1 = new ethers.Wallet(process.env.VALIDATOR_0_PK || '');
  const validator2 = new ethers.Wallet(process.env.VALIDATOR_1_PK || '');

  const signatures = await Promise.all([
    deviationSigner.apply(hre, networkId, umbrellaFeeds.address, validator1, keys, Object.values(data)),
    deviationSigner.apply(hre, networkId, umbrellaFeeds.address, validator2, keys, Object.values(data)),
  ]);

  const tx = await umbrellaFeeds.update(
    keys,
    Object.values(data),
    signatures.map((s) => ethers.utils.splitSignature(s)),
  );

  console.log(`${UMBRELLA_FEEDS} tx ${tx.hash}`);

  await tx.wait(1);
});
