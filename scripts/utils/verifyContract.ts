import superagent from 'superagent';
import { isLocalNetwork, sleep } from './helpers';
import fs from 'fs';
import { ENVS, NETWORKS } from '../../config';

const { NODE_ENV, NETWORK, BSCSCAN_API, ETHERSCAN_API } = process.env;

const getScanApiUrl = (): string | undefined => {
  if (NETWORK === NETWORKS.ETH) {
    let prefix = '';

    switch (NODE_ENV) {
      case 'live':
        break;
      case 'development':
      case 'dev':
      case 'staging':
        prefix = '-kovan';
        break;
      case 'production':
        prefix = '-ropsten';
        break;
      default:
        return undefined;
    }

    return `https://api${prefix}.etherscan.io/api`;
  }

  if (NETWORK === NETWORKS.BSC) {
    if (NODE_ENV === ENVS.local) {
      return undefined;
    }
    let prefix = '';

    switch (NODE_ENV) {
      case 'live':
      case 'production':
        break;
      case 'development':
      case 'dev':
      case 'staging':
        prefix = '-testnet';
        break;
      default:
        return undefined;
    }

    return `https://api${prefix}.bscscan.com/api`;
  }

  return undefined;
};

export const pullSource = (contractName: string): string => {
  const flattenedSol = __dirname + '/../../flattened_' + contractName + '.sol';
  return fs.readFileSync(flattenedSol).toString();
};

export const verifyContract = async (
  contractaddress: string,
  contractname: string,
  constructorArguements: string
): Promise<void> => {
  if (isLocalNetwork()) {
    return;
  }

  if (!process.env.ETHERSCAN_API) {
    throw Error('missing process.env.ETHERSCAN_API');
  }

  console.log('VERIFY CONTRACT', contractname);
  console.log('doing API call...');
  let notok = true;

  const scanApiUrl = getScanApiUrl();

  if (scanApiUrl === undefined) {
    console.log('NODE_ENV not set....');
    return;
  }

  //Submit Source Code for Verification
  while (notok) {
    console.log(`[${Math.trunc(Date.now() / 1000)}] waiting 5sec...`);
    await sleep(5000);

    const response = await superagent
      .post(scanApiUrl) //Set to the  correct API url for Other Networks
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send({
        apikey: NETWORK === NETWORKS.BSC ? BSCSCAN_API : ETHERSCAN_API, //A valid API-Key is required
        module: 'contract', //Do not change
        action: 'verifysourcecode', //Do not change
        contractaddress, //Contract Address starts with 0x...
        sourceCode: pullSource(contractname), //Contract Source Code (Flattened if necessary)
        //solidity-single-file (default) or solidity-standard-json-input (for std-input-json-format support
        codeformat: 'solidity-single-file',
        //ContractName (if codeformat=solidity-standard-json-input, then enter contractname as ex: erc20.sol:erc20)
        contractname,
        // see https://etherscan.io/solcversions for list of support versions
        compilerversion: 'v0.6.8+commit.0bbfe453',
        //0 = No Optimization, 1 = Optimization used (applicable when codeformat=solidity-single-file)
        optimizationUsed: 0,
        runs: 200, //set to 200 as default unless otherwise  (applicable when codeformat=solidity-single-file)
        constructorArguements, //if applicable
        // leave blank for compiler default, homestead, tangerineWhistle, spuriousDragon, byzantium, constantinople,
        // petersburg, istanbul (applicable when codeformat=solidity-single-file)
        evmversion: '',
        //Valid codes 1-12 where 1=No License .. 12=Apache 2.0, see https://etherscan.io/contract-license-types
        licenseType: 3,
      });

    notok = response.body.message != 'OK';
    console.log(response.body);
  }
};
