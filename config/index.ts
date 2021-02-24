const env = process.env.NODE_ENV || 'local';

import local from './local';
import dev from './dev';
import staging from './staging';
import production from './production';

const configuration = (environment = env): any => {
  switch (environment) {
  case 'local': return local;
  case 'dev': return dev;
  case 'staging': return staging;
  case 'production': return production;
  }
};

export default configuration;
