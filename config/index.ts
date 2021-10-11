import {Config} from './types';

import local from './local';
import staging from './staging';
import production from './production';
import sandbox from './sandbox';

export enum NETWORKS {
  ETH = 'ethereum',
  BSC = 'smartchain'
}

export enum ENVS {
  local = 'local',
  staging = 'staging',
  production = 'production',
  sandbox = 'sandbox'
}

const [blockchain, environment] = process.env.HARDHAT_NETWORK?.split('_') || [NETWORKS.ETH, ENVS.local];

const network = blockchain || NETWORKS.ETH;
const env = environment || ENVS.local;

const configuration = (environment = env): Config => {
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
