import { task } from 'hardhat/config';
import fs from 'fs';
import axios from 'axios';

/*
npx hardhat standard-json --network avalanche_production --contract StakingBankStatic
 */
task('standard-json', 'get Standard Json')
  .addOptionalParam('contract')
  .addOptionalParam('address')
  .setAction(async (taskArgs, hre) => {
    const { address } = taskArgs.address ? taskArgs : await hre.deployments.get(taskArgs.contract);

    console.log({ contract: taskArgs.contract, address });

    let apiKey = '';
    let apiUrl = '';

    switch (hre.network.name) {
      case 'avalanche_production':
        apiKey = process.env.AVASCAN_API || '';
        apiUrl = 'https://api.snowtrace.io/api';
        break;

      default:
        throw new Error(`${hre.network.name} not supported`);
    }

    const response = await axios.get(
      apiUrl + `?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`
    );

    const f = __dirname + `/../flattened/${taskArgs.contract}.stdandard.json`;

    if (JSON.stringify(response.data.result[0]).includes('Contract source code not verified')) {
      throw new Error('Contract source code not verified');
    }

    fs.writeFileSync(f, response.data.result[0].SourceCode.slice(1, -1));

    console.log('open browser and use this file to verify source:');
    console.log(f);
  });
