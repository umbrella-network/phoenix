import { task } from 'hardhat/config';
import fs from 'fs';
import axios from 'axios';
import {
  AVALANCHE_PRODUCTION,
  AVALANCHE_SANDBOX,
  AVALANCHE_STAGING,
  LINEA_SANDBOX,
  POLYGON_SANDBOX,
} from '../constants/networks';

task('linea-verify', 'task for debugging')
  .addOptionalParam('name')
  .addOptionalParam('address')
  .setAction(async (taskArgs, hre) => {
    const { address } = taskArgs.address ? taskArgs : await hre.deployments.get(taskArgs.name);

    console.log({ name: taskArgs.name, address });

    const { AVASCAN_API, POLYGONSCAN_API } = process.env;

    let response;

    switch (hre.network.name) {
      case AVALANCHE_SANDBOX:
      case AVALANCHE_STAGING:
        response = await axios.get(
          'https://api-testnet.snowtrace.io/api?' +
            `module=contract&action=getsourcecode&address=${address}&apikey=${AVASCAN_API}`,
        );
        break;

      case AVALANCHE_PRODUCTION:
        response = await axios.get(
          'https://api.snowtrace.io/api?' +
            `module=contract&action=getsourcecode&address=${address}&apikey=${AVASCAN_API}`,
        );
        break;

      case LINEA_SANDBOX:
        response = await axios.get(
          'https://api-testnet.lineascan.build/api?' +
            `module=contract&action=getsourcecode&address=${address}&apikey=${POLYGONSCAN_API}`,
        );
        break;

      case POLYGON_SANDBOX:
        response = await axios.get(
          'https://api-testnet.polygonscan.com/api?' +
            `module=contract&action=getsourcecode&address=${address}&apikey=${POLYGONSCAN_API}`,
        );
        break;

      default:
        throw new Error(`${hre.network.name} NOT supported`);
    }

    const f = __dirname + `/../flattened/${hre.network.name}__${taskArgs.name}.stdandard.json`;

    try {
      fs.writeFileSync(f, response.data.result[0].SourceCode.slice(1, -1));
      console.log('open linea browser and use this file to verify source:');
      console.log(f);
    } catch (e) {
      console.log(response);
      console.log(e);
    }
  });
