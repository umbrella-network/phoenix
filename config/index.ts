import {Config} from './Config';

const env = process.env.NODE_ENV || 'local';

import local from './local';
import dev from './dev';
import production from './production';

const configuration = (environment = env): Config => {
  switch (environment) {
  case 'local':
    return local;
  case 'dev':
    return dev;
  case 'production':
    return production;
  default:
    throw Error(`invalid environment: ${environment}`);
  }
};

export default configuration;
