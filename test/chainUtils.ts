import { artifacts, ethers } from 'hardhat';
import { Contract, ContractFactory, Signer, Wallet } from 'ethers';
import { constants as SDKConstants, LeafValueCoder } from '@umb-network/toolbox';
import { remove0x } from '@umb-network/toolbox/dist/utils/helpers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import SortedMerkleTree from '../lib/SortedMerkleTree';
import { deployMockContract, MockContract } from '@ethereum-waffle/mock-contract';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { toBytes32 } from '../scripts/utils/helpers';
import { Receipt } from 'hardhat-deploy/dist/types';
import { CHAIN, REGISTRY, STAKING_BANK } from '../constants';
import { SubmitPreparedData } from '../types/types';

const { SIGNED_NUMBER_PREFIX } = SDKConstants;

const inputsData: Record<string, Buffer> = {};

export const keys = [
  'ETH-EUR',
  'BTC-EUR',
  'WAR-EUR',
  'LTC-EUR',
  'UNI-EUR',
  'ETH-USD',
  'BTC-USD',
  'WAR-USD',
  'LTC-USD',
  'UNI-USD',
  SIGNED_NUMBER_PREFIX + 'INT',
];

keys.forEach((k, i) => {
  inputsData[k] = LeafValueCoder.isSignedValue(k) ? LeafValueCoder.encode(-321, k) : LeafValueCoder.encode(i + 1, k);
});

console.log({ inputsData });

export const inputs = inputsData;

export const tree = new SortedMerkleTree(inputs);

export const abiUintEncoder = (n: number | string, bits = 256): string =>
  (typeof n === 'number' ? n.toString(16) : remove0x(n)).padStart(bits / 4, '0');

export const prepareData = async (
  signer: Signer | Wallet,
  dataTimestamp: number,
  root: string | null,
  fcdKeys: string[] = [],
  fcdValues: (number | string)[] = []
): Promise<SubmitPreparedData> => {
  let testimony = '0x' + abiUintEncoder(dataTimestamp, 32) + root?.replace('0x', '');

  for (let i = 0; i < fcdKeys.length; i++) {
    if (typeof fcdValues[i] === 'string' && !ethers.utils.isHexString(fcdValues[i])) {
      throw Error(`if FCD is a string, then must be hex string: ${fcdValues[i]}`);
    }

    testimony += fcdKeys[i].replace('0x', '') + abiUintEncoder(fcdValues[i]);
  }

  const hashForSolidity = ethers.utils.keccak256(testimony);
  const affidavit = ethers.utils.arrayify(hashForSolidity);

  const sig = await signer.signMessage(affidavit);
  const { r, s, v } = ethers.utils.splitSignature(sig);

  return { testimony, affidavit, sig, r, s, v, hashForSolidity, dataTimestamp };
};

export const mockSubmit = async (props: {
  stakingBank: MockContract;
  leader: SignerWithAddress | Wallet;
  totalSupply?: number;
  balance?: number;
}) => {
  const totalSupply = props.totalSupply ?? 1000;
  const balance = props.balance ?? 1000;

  await props.stakingBank.mock.totalSupply.returns(totalSupply);
  await props.stakingBank.mock.balanceOf.withArgs(props.leader.address).returns(balance);
};

export const executeSubmit = async (props: {
  chain: Contract;
  stakingBank: MockContract;
  dataTimestamp: number;
  validators: SignerWithAddress[] | Wallet[];
  root: string;
}): Promise<unknown> => {
  const { chain, stakingBank, dataTimestamp, validators, root } = props;

  await mockSubmit({ stakingBank, leader: validators[0] });

  if (validators.length > 1) {
    await stakingBank.mock.balanceOf.withArgs(validators[1].address).returns(1000);
  }

  const vv: number[] = [];
  const rr: string[] = [];
  const ss: string[] = [];

  for (const participant of validators) {
    const { r, s, v } = await prepareData(participant, dataTimestamp, root);
    vv.push(v);
    rr.push(r);
    ss.push(s);
  }

  return chain.connect(validators[0]).submit(dataTimestamp, root, [], [], vv, rr, ss);
};

export const setupForChainWithMocks = async (props: {
  hre: HardhatRuntimeEnvironment;
  padding?: number;
  requiredSignatures?: number;
  allowForMixedType?: boolean;
}) => {
  const { hre } = props;

  const Registry = artifacts.readArtifactSync(REGISTRY);
  const Chain = artifacts.readArtifactSync(CHAIN);
  const StakingBank = artifacts.readArtifactSync(STAKING_BANK);
  const Token = artifacts.readArtifactSync('Token');

  const timePadding = props.padding || 100;
  const requiredSignatures = props.requiredSignatures || 1;
  const allowForMixedType = props.allowForMixedType || false;

  const [owner, validator, validator2] = await hre.ethers.getSigners();
  const token = await deployMockContract(owner, Token.abi);
  const contractRegistry = await deployMockContract(owner, Registry.abi);
  const stakingBank = await deployMockContract(owner, StakingBank.abi);
  const contractFactory = new ContractFactory(Chain.abi, Chain.bytecode, owner);

  await contractRegistry.mock.getAddress.withArgs(toBytes32('Chain')).returns(ethers.constants.AddressZero);
  await contractRegistry.mock.requireAndGetAddress.withArgs(toBytes32('StakingBank')).returns(stakingBank.address);

  const contract = await contractFactory.deploy(
    contractRegistry.address,
    timePadding,
    requiredSignatures,
    allowForMixedType
  );

  return {
    owner,
    validator,
    validator2,
    validatorAddress: await validator.getAddress(),
    token,
    contractRegistry,
    stakingBank,
    contract,
    contractFactory,
  };
};

export const fetchLogVotersEvents = (tx: Receipt): { blockId: number; voter: string; vote: bigint }[] => {
  if (!tx || !tx.events) throw Error('something went wrong, tx.events empty');

  const eventName = 'LogVoter';
  const abi = artifacts.readArtifactSync(CHAIN).abi;

  const eventTypes = abi
    .find((item: { name: string }) => item.name == eventName)
    .inputs.map((field: { type: string }) => field.type);

  const sighash = ethers.utils.id(`${eventName}(${eventTypes.join(',')})`);

  const txEvents = tx.events.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => e.topics[0] === sighash
  );

  return txEvents.map((e) => {
    return {
      blockId: parseInt(e['topics'][1], 16),
      voter: ethers.utils.defaultAbiCoder.decode(['address'], e['topics'][2])[0],
      vote: BigInt(e['data']),
    };
  });
};

export const sortWallets = (wallets: Wallet[]): Wallet[] =>
  wallets.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1));
