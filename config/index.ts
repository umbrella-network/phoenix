import {Config} from './types';

import local from './local';
import dev from './dev';
import production from './production';

const env = process.env.NODE_ENV || 'local';

const configuration = (environment = env): Config => {
  switch (environment) {
  case 'local':
    return local;
  case 'dev':
  case 'development':
    return dev;
  case 'production':
    return production;
  default:
    throw Error(`invalid environment: ${environment}`);
  }
};

export default configuration;
