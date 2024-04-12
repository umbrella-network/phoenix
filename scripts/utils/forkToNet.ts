import { HardhatRuntimeEnvironment } from 'hardhat/types';

export const forkToNet = async (hre: HardhatRuntimeEnvironment, network: string, block?: number) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fork: any = hre.config.networks[network];

  console.log(`### switch to forking ${network} ###`);

  await hre.network.provider.request({
    method: 'hardhat_reset',
    params: [
      {
        forking: {
          jsonRpcUrl: fork.url,
          url: fork.url,
          blockNumber: block,
        },
      },
    ],
  });

  console.log('chainId:', (await hre.ethers.provider.getNetwork()).chainId);
};
