import { ethers, Contract } from 'ethers';
import superagent from 'superagent';
import { deployedContract } from './utils/deployedContracts';
import { getProvider, pressToContinue, waitForTx } from './utils/helpers';
import { formatEther } from 'ethers/lib/utils';
import ERC20 from '../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
import configuration from '../config';

const provider = getProvider();
const config = configuration();
const { PEGASUS_VERSION } = process.env;

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

  if (registeredValidator.id !== ethers.constants.AddressZero) {
    throw Error(`validator ${info.validator} already registered`);
  }

  return true;
};

const registerNewValidator = async () => {
  const location = process.env.NEW_VALIDATOR_LOCATION as string;
  const stake = BigInt(process.env.NEW_VALIDATOR_STAKE as string) * BigInt(1e18);

  if (!stake) {
    throw Error(`stake value invalid: ${stake} UMB`);
  }

  console.log(`Adding new validator based on location: ${location} with stake of ${stake} UMB`);

  stakingBank = await deployedContract('StakingBank');
  const token = await deployedContract('UMB');

  const info = await resolveValidatorInfo(location);
  await checkValidator(info);

  const validator: Validator = {
    id: info.validator,
    location,
  };

  if (!validator.id || !validator.location) {
    throw Error('New validator has empty data, please setup env: NEW_VALIDATOR_LOCATION');
  }

  console.log('new validator:', validator);
  console.log('stakingBank:', stakingBank.address);
  console.log('token:', token.address);

  const registeredValidator = await stakingBank.validators(validator.id);

  if (registeredValidator.id !== ethers.constants.AddressZero) {
    throw Error(`validator ${validator.id} already registered`);
  }

  let tx = await stakingBank.create(validator.id, validator.location);
  await waitForTx(tx.hash, provider);
  console.log('new validator created');

  console.log('staking tokens');

  try {
    tx = await token.mintApproveAndStake(stakingBank.address, validator.id, stake.toString(10));
    await waitForTx(tx.hash, provider);
    console.log('mintApproveAndStake DONE');
  } catch (e) {
    console.log(e);
    console.log('mintApproveAndStake not available, please stake manually');
  }
};

pressToContinue('y', () => {
  registerNewValidator()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
});
