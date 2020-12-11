require('custom-env').env();

const {deployAllContracts} = require('./deployers/contracts');

deployAllContracts('', true)
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
