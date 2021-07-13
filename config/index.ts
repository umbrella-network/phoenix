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

const env = process.env.NODE_ENV || ENVS.local;
const network = process.env.NETWORK || NETWORKS.ETH;

const configuration = (environment = env): Config => {
  switch (environment) {
    case ENVS.local:
      return (local as any)[network];
    case ENVS.staging:
      return (staging as any)[network];
    case ENVS.sandbox:
      return (sandbox as any)[network];
    case ENVS.production:
      return (production as any)[network];
    default:
      throw Error(`invalid environment: ${environment}`);
  }
};

export default configuration;
