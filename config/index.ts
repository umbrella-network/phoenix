import {Config} from './types';

import local from './local';
import staging from './staging';
import production from './production';
import sandbox from './sandbox';

export enum NETWORKS {
  ETH = 'ethereum',
  BSC = 'bsc'
}

export enum ENVS {
  local = 'local',
  staging = 'staging',
  production = 'production',
  sandbox = 'sandbox'
}

const defaultNetwork = NETWORKS.BSC;
const defaultEnv = ENVS.local;

const [blockchain, environment] = process.env.HARDHAT_NETWORK?.split('_') || [defaultNetwork, defaultEnv];

const network = blockchain || defaultNetwork;
const env = environment || defaultEnv;

const configuration = (environment = env): Config => {
  console.log({environment, network});

  switch (environment) {
    case ENVS.local:
      return (local as any)[network]; // eslint-disable-line @typescript-eslint/no-explicit-any
    case ENVS.staging:
      return (staging as any)[network]; // eslint-disable-line @typescript-eslint/no-explicit-any
    case ENVS.sandbox:
      return (sandbox as any)[network]; // eslint-disable-line @typescript-eslint/no-explicit-any
    case ENVS.production:
      return (production as any)[network]; // eslint-disable-line @typescript-eslint/no-explicit-any
    default:
      throw Error(`invalid environment: ${environment}`);
  }
};

export default configuration;
