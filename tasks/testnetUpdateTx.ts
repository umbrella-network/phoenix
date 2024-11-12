import { task } from 'hardhat/config';
import { ethers } from 'ethers';

import { UMBRELLA_FEEDS } from '../constants';
import { UmbrellaFeeds__factory } from '../typechain';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeviationSigner } from '../test/utils/DeviationSigner';
import { deployerSigner } from './_helpers/jsonRpcProvider';

/*
VALIDATOR_0_PK=... \
VALIDATOR_1_PK=... \
npx hardhat testnetUpdateTx --network bob_staging


 */
task('testnetUpdateTx', 'testnet update tx').setAction(async (_, hre: HardhatRuntimeEnvironment) => {
  const networkId = (await hre.ethers.provider.getNetwork()).chainId;
  const deviationSigner = new DeviationSigner();
  const deployer = deployerSigner(hre);

  const umbrellaFeedsDeployments = await hre.deployments.get(UMBRELLA_FEEDS);
  const umbrellaFeeds = UmbrellaFeeds__factory.connect(umbrellaFeedsDeployments.address, deployer);

  const t = Math.trunc(Date.now() / 1000);

  const data = {
    'TEST-NET': {
      data: 0,
      heartbeat: 1,
      timestamp: t,
      price: t,
    },
    'TEST-FEED': {
      data: 0,
      heartbeat: 1,
      timestamp: t,
      price: t,
    },
  };

  const keys = Object.keys(data).map((k) => ethers.utils.id(k));

  console.log({ keys });
  console.log(process.env.VALIDATOR_0_PK);
  console.log(process.env.VALIDATOR_1_PK);

  const validator1 = new ethers.Wallet(process.env.VALIDATOR_0_PK || '');
  const validator2 = new ethers.Wallet(process.env.VALIDATOR_1_PK || '');

  console.log(Object.values(data));

  const signatures = await Promise.all([
    deviationSigner.apply(hre, networkId, umbrellaFeeds.address, validator2, keys, Object.values(data)),
    deviationSigner.apply(hre, networkId, umbrellaFeeds.address, validator1, keys, Object.values(data)),
  ]);

  console.log(signatures);

  const tx = await umbrellaFeeds.update(
    keys,
    Object.values(data),
    signatures.map((sign) => {
      const { v, r, s } = ethers.utils.splitSignature(sign);
      return { v, r, s };
    }),
  );

  console.log(`${UMBRELLA_FEEDS} ${umbrellaFeeds.address} tx ${tx.hash}`);

  await tx.wait(1);
});
