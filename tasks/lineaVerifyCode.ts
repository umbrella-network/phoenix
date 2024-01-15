import { task } from 'hardhat/config';
import fs from 'fs';
import axios from 'axios';
import { AVALANCHE_STAGING } from '../constants/networks';

task('linea-verify', 'task for debugging')
  .addOptionalParam('name')
  .addOptionalParam('address')
  .setAction(async (taskArgs, hre) => {
    if (hre.network.name !== AVALANCHE_STAGING) throw new Error(`only ${AVALANCHE_STAGING} supported`);

    const { address } = taskArgs.address ? taskArgs : await hre.deployments.get(taskArgs.name);

    console.log({ name: taskArgs.name, address });

    const { AVASCAN_API } = process.env;
    const response = await axios.get(
      'https://api-testnet.snowtrace.io/api?' +
        `module=contract&action=getsourcecode&address=${address}&apikey=${AVASCAN_API}`,
    );

    const f = __dirname + `/../flattened/${taskArgs.name}.stdandard.json`;

    fs.writeFileSync(f, response.data.result[0].SourceCode.slice(1, -1));

    console.log('open linea browser and use this file to verify source:');
    console.log(f);
  });
