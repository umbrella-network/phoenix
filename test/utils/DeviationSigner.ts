import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, Wallet } from 'ethers';
import { UMBRELLA_FEEDS } from '../../constants';
import { IUmbrellaFeeds } from '../../typechain';

type PriceDataStruct = IUmbrellaFeeds.PriceDataStruct;

export class DeviationSigner {
  async apply(
    hre: HardhatRuntimeEnvironment,
    networkId: number,
    target: string,
    validator: SignerWithAddress | Wallet,
    keys: string[],
    priceDatas: PriceDataStruct[],
  ): Promise<string> {
    const hash = await this.hashData(hre, networkId, target, keys, priceDatas);
    const toSign = ethers.utils.arrayify(hash);
    return validator.signMessage(toSign);
  }

  async hashData(
    hre: HardhatRuntimeEnvironment,
    networkId: number,
    target: string,
    keys: string[],
    priceDatas: PriceDataStruct[],
  ): Promise<string> {
    const testimony = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'address', ...(await this.priceDatasAbi(hre))],
      [networkId, target, keys, priceDatas],
    );

    return ethers.utils.keccak256(testimony);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async priceDatasAbi(hre: HardhatRuntimeEnvironment): Promise<any> {
    const artifacts = await hre.artifacts.readArtifact(UMBRELLA_FEEDS);
    const submitAbi = artifacts.abi.find((data: { name?: string }) => data?.name === 'update');
    if (!submitAbi) throw new Error('missing submit in ABI');

    const { inputs } = submitAbi;

    // [keys, priceDatas]
    return [inputs[0], inputs[1]];
  }
}
