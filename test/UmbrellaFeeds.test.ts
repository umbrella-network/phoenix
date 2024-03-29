import hre, { artifacts } from 'hardhat';
import 'hardhat';
import '@nomiclabs/hardhat-ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { expect, use } from 'chai';
import { ethers, ContractFactory } from 'ethers';
import { waffleChai } from '@ethereum-waffle/chai';
import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { toBytes32 } from '../scripts/utils/helpers';
import { IUmbrellaFeeds, UmbrellaFeeds, UmbrellaFeeds__factory } from '../typechain';

import { REGISTRY, ISTAKING_BANK, UMBRELLA_FEEDS } from '../constants';

type PriceDataStruct = IUmbrellaFeeds.PriceDataStruct;

use(waffleChai);

class DeviationSigner {
  async apply(
    networkId: number,
    target: string,
    validator: SignerWithAddress,
    keys: string[],
    priceDatas: PriceDataStruct[],
  ): Promise<string> {
    const hash = await this.hashData(networkId, target, keys, priceDatas);
    const toSign = ethers.utils.arrayify(hash);
    return validator.signMessage(toSign);
  }

  async hashData(networkId: number, target: string, keys: string[], priceDatas: PriceDataStruct[]): Promise<string> {
    const testimony = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'address', ...(await this.priceDatasAbi())],
      [networkId, target, keys, priceDatas],
    );

    return ethers.utils.keccak256(testimony);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async priceDatasAbi(): Promise<any> {
    const artifacts = await hre.artifacts.readArtifact(UMBRELLA_FEEDS);
    const submitAbi = artifacts.abi.find((data: { name?: string }) => data?.name === 'update');
    if (!submitAbi) throw new Error('missing submit in ABI');

    const { inputs } = submitAbi;

    // [keys, priceDatas]
    return [inputs[0], inputs[1]];
  }
}

const setupForFeedsWithMocks = async (props: {
  hre: HardhatRuntimeEnvironment;
  requiredSignatures?: number;
  decimals?: number;
}) => {
  const { hre } = props;

  const Registry = artifacts.readArtifactSync(REGISTRY);
  const UmbrellaFeed = artifacts.readArtifactSync(UMBRELLA_FEEDS);
  const StakingBank = artifacts.readArtifactSync(ISTAKING_BANK);

  const requiredSignatures = props.requiredSignatures || 1;

  const [owner, validator, validator2] = await hre.ethers.getSigners();
  const contractRegistry = await deployMockContract(owner, Registry.abi);
  const stakingBank = await deployMockContract(owner, StakingBank.abi);
  const contractFactory = new ContractFactory(UmbrellaFeed.abi, UmbrellaFeed.bytecode, owner);

  await contractRegistry.mock.requireAndGetAddress.withArgs(toBytes32('StakingBank')).returns(stakingBank.address);

  const contract = await contractFactory.deploy(contractRegistry.address, requiredSignatures, props.decimals || 8);

  return {
    owner,
    validator,
    validator2,
    contractRegistry,
    stakingBank,
    contract: UmbrellaFeeds__factory.connect(contract.address, hre.ethers.provider),
    contractFactory,
  };
};

describe('UmbrellaFeeds', () => {
  const deviationSigner = new DeviationSigner();

  let networkId: number;
  let validator: SignerWithAddress, contract: UmbrellaFeeds;

  describe('test signatures', () => {
    beforeEach(async () => {
      ({ validator, contract } = await setupForFeedsWithMocks({ hre }));
      networkId = (await hre.ethers.provider.getNetwork()).chainId;
    });

    it('#hashSubmitData', async () => {
      const data = {
        'UMB-USD': {
          data: 0,
          price: 1508617n,
          timestamp: 1683302212,
          heartbeat: 86400,
        },
        'ARB-USD': {
          data: 0,
          price: 133065000n,
          timestamp: 1683302212,
          heartbeat: 86400,
        },
      };

      const keys = Object.keys(data).map((k) => ethers.utils.id(k));
      const expectedHash = await contract.hashData(keys, Object.values(data));

      expect(deviationSigner.hashData(networkId, contract.address, keys, Object.values(data)), expectedHash);
    });

    it('#recoverSigner', async () => {
      const data = {
        'UMB-USD': {
          data: 0,
          price: 1508617n,
          timestamp: 1683302212,
          heartbeat: 86400,
        },
        'ARB-USD': {
          data: 0,
          price: 133065000n,
          timestamp: 1683302212,
          heartbeat: 86400,
        },
      };

      const keys = Object.keys(data).map((k) => ethers.utils.id(k));
      const hash = deviationSigner.hashData(networkId, contract.address, keys, Object.values(data));
      const signature = await deviationSigner.apply(networkId, contract.address, validator, keys, Object.values(data));
      const { v, r, s } = ethers.utils.splitSignature(signature);

      const expectedAddress = await contract.recoverSigner(hash, v, r, s);

      expect(expectedAddress, validator.address);
    });
  });
});
