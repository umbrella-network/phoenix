require('custom-env').env();

const {deployAll} = require('./deploy-all');

deployAll()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
