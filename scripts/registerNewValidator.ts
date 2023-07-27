import { ethers, Contract } from 'ethers';
import superagent from 'superagent';
import { deployedContract } from './utils/deployedContracts';

const { PEGASUS_VERSION } = process.env;

interface ValidatorInfo {
  validator: string;
  contractRegistryAddress: string;
  chainContractAddress: string;
  version: string;
  environment: string;
  name: string;
}

let stakingBank: Contract;

export const resolveValidatorInfo = async (location: string): Promise<ValidatorInfo> => {
  const res = await superagent.get(`${location}/info`);
  return res.body;
};

export const checkValidator = async (info: ValidatorInfo): Promise<boolean> => {
  if (!ethers.utils.isAddress(info.validator)) {
    throw Error(`${info.validator} is not valid address`);
  }

  console.log(`address ${info.validator} OK`);

  if (info.version !== PEGASUS_VERSION) {
    throw Error(`${info.version} is not last version => ${PEGASUS_VERSION}`);
  }

  console.log(`version ${info.version} OK`);

  const chain = await deployedContract('Chain');

  if (info.chainContractAddress !== chain.address) {
    throw Error(`${info.chainContractAddress} is not Chain from this network, should be ${chain.address}`);
  }

  console.log(`Chain ${info.chainContractAddress} OK`);

  const registeredValidator = await stakingBank.validators(info.validator);

  if (registeredValidator.id !== ethers.constants.AddressZero) {
    throw Error(`validator ${info.validator} already registered`);
  }

  return true;
};
