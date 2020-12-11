require('custom-env').env();

const {deployContractRegistry} = require('./deployers/registry');

deployContractRegistry()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
