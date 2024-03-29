import hre, { artifacts } from 'hardhat';
import { ethers, Contract } from 'ethers';
import { formatEther } from 'ethers/lib/utils';
import superagent from 'superagent';
import { deployedContract } from './utils/deployedContracts';
import { pressToContinue, waitForTx } from './utils/helpers';
import configuration from '../config';

const provider = hre.ethers.provider;
const config = configuration();

const { PEGASUS_VERSION } = process.env;

const ERC20 = artifacts.readArtifactSync('ERC20');

interface Validator {
  id: string;
  location: string;
}

interface ValidatorInfo {
  validator: string;
  contractRegistryAddress: string;
  chainContractAddress: string;
  version: string;
  environment: string;
  name: string;
}

let stakingBank: Contract;

const resolveValidatorInfo = async (location: string): Promise<ValidatorInfo> => {
  const res = await superagent.get(`${location}/info`);
  return res.body;
};

const checkValidator = async (info: ValidatorInfo): Promise<boolean> => {
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

  const balance = await provider.getBalance(info.validator);

  if (balance.lt(`3${'0'.repeat(17)}`)) {
    throw Error(`validator balance is too low: ${formatEther(balance)}`);
  }

  console.log(`validator balance: ${formatEther(balance)} OK`);

  if (!config.token.address) {
    throw Error('UMB token address empty');
  }

  const umb = new Contract(config.token.address, ERC20.abi, provider);
  const umbBalance = await umb.balanceOf(info.validator);

  if (umbBalance.lt(`100${'0'.repeat(18)}`)) {
    throw Error(`validator UMB balance is too low: ${formatEther(umbBalance)}`);
  }

  console.log(`validator UMB balance: ${formatEther(umbBalance)} OK`);

  const registeredValidator = await stakingBank.validators(info.validator);

  if (registeredValidator.id === ethers.constants.AddressZero) {
    throw Error(`validator ${info.validator} NOT registered`);
  }

  return true;
};

const updateValidator = async () => {
  const location = process.env.NEW_VALIDATOR_LOCATION as string;

  console.log(`Updating validator based on location: ${location}`);

  stakingBank = await deployedContract('StakingBank');
  const token = await deployedContract('UMB');

  const info = await resolveValidatorInfo(location);
  await checkValidator(info);

  const validator: Validator = {
    id: info.validator,
    location,
  };

  if (!validator.id || !validator.location) {
    throw Error('validator has empty data, please setup env: NEW_VALIDATOR_LOCATION');
  }

  console.log('validator:', validator);
  console.log('stakingBank:', stakingBank.address);
  console.log('token:', token.address);

  const registeredValidator = await stakingBank.validators(validator.id);

  if (registeredValidator.id.toLowerCase() !== validator.id.toLowerCase()) {
    throw new Error(`validator ${validator.id} not registered`);
  }

  if (registeredValidator.location.toLowerCase() === validator.location.toLowerCase()) {
    throw new Error(`validator ${validator.id} has same location`);
  }

  const tx = await stakingBank.update(validator.id, validator.location);
  await waitForTx(hre, tx.hash);
  console.log('validator updated');
};

// hardhat compile && HARDHAT_NETWORK=bsc_production npx hardhat run ./scripts/updateValidator.ts
pressToContinue(hre, 'y', () => {
  updateValidator()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
});
