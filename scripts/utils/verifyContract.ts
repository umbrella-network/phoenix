import superagent from 'superagent';
import {isLocalNetwork, sleep} from './helpers';
import fs from 'fs';

const netName = (): string | undefined => {
  switch (process.env.NODE_ENV) {
  case 'live':
    return '';
  case 'development':
  case 'dev':
    return '-kovan';
  case 'staging':
  case 'production':
    return '-ropsten';
  default:
    return undefined;
  }
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

  const network = netName();

  if (network === undefined) {
    console.log('NODE_ENV not set....');
    return;
  }

  //Submit Source Code for Verification
  while (notok) {
    console.log('waiting 5sec...');
    await sleep(5000);

    const response = await superagent
      .post(`https://api${network}.etherscan.io/api`) //Set to the  correct API url for Other Networks
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send({
        apikey: process.env.ETHERSCAN_API,                     //A valid API-Key is required
        module: 'contract',                             //Do not change
        action: 'verifysourcecode',                     //Do not change
        contractaddress,   //Contract Address starts with 0x...
        sourceCode: pullSource(contractname),             //Contract Source Code (Flattened if necessary)
        //solidity-single-file (default) or solidity-standard-json-input (for std-input-json-format support
        codeformat: 'solidity-single-file',
        //ContractName (if codeformat=solidity-standard-json-input, then enter contractname as ex: erc20.sol:erc20)
        contractname,
        // see https://etherscan.io/solcversions for list of support versions
        compilerversion: 'v0.6.8+commit.0bbfe453',
        //0 = No Optimization, 1 = Optimization used (applicable when codeformat=solidity-single-file)
        optimizationUsed: 0,
        runs: 200,  //set to 200 as default unless otherwise  (applicable when codeformat=solidity-single-file)
        constructorArguements,   //if applicable
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
