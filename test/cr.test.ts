import 'hardhat';
import '@nomiclabs/hardhat-ethers';

import hre from 'hardhat';
import { use } from 'chai';
import { ethers, Wallet, Signer, ContractFactory } from 'ethers';
import { waffleChai } from '@ethereum-waffle/chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { doSnapshot, revertSnapshot } from '../scripts/utils/helpers';
import { abiUintEncoder, sortWallets } from './chainUtils';
import { SubmitPreparedData } from '../types/types';
import {CR, CR__factory} from '../typechain';

use(waffleChai);

const prepareData = async (args: {
  signer: Signer | Wallet;
  dataTimestamp: number;
  fcdKeys: string[];
  fcdValues: (number | string)[];
}): Promise<SubmitPreparedData> => {
  const { dataTimestamp, fcdValues, fcdKeys, signer } = args;

  let testimony = '0x' + abiUintEncoder(dataTimestamp, 32);

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

const randomData = async () => {
  const dataTimestamp = Math.trunc(Math.random() * 1000) + 1;;
  const allValidators: Wallet[] = [];
  const requiredSignatures = 10;

  for (let i = 0; i < requiredSignatures; i++) {
    const wallet = ethers.Wallet.createRandom();
    allValidators.push(wallet);
  }

  const sorted = sortWallets(allValidators);

  const vv: number[] = [];
  const rr: string[] = [];
  const ss: string[] = [];

  const key = '0x45'.padEnd(66, '0');
  const value = Math.trunc(Math.random() * 100000000) + 1;

  for (const participant of sorted) {
    const { r, s, v } = await prepareData({
      signer: participant,
      dataTimestamp,
      fcdKeys: [key],
      fcdValues: [value],
    });
    vv.push(v);
    rr.push(r);
    ss.push(s);
  }

  return {dataTimestamp, key, value, vv, rr, ss};
};

describe.only('CR', () => {
  let owner: SignerWithAddress, cr: CR;

  let genesisSnapshotId: unknown;

  beforeEach(async () => {
    genesisSnapshotId = await doSnapshot(hre);
  });

  afterEach(async () => {
    await revertSnapshot(hre, genesisSnapshotId);
  });

  describe('test signatures', () => {
    beforeEach(async () => {
      [owner] = await hre.ethers.getSigners();
      const CRArtifacts = await hre.artifacts.readArtifact('CR');
      const contractFactory = new ContractFactory(CRArtifacts.abi, CRArtifacts.bytecode, owner);
      const contract = await contractFactory.deploy();
      cr = CR__factory.connect(contract.address, owner);
    });

    it('emits LogVoter event only for valid validators', async () => {
      let i = 5;
      while (i-- > 0) {
        const {dataTimestamp, key, value, vv, rr, ss} = await randomData();

        const tx = await cr.submitOneFcd(dataTimestamp, key, value, vv, rr, ss);
        const receipt = await tx.wait(1);
        const gas = receipt.cumulativeGasUsed.toBigInt();
        console.log({gas, value, signatures: rr.length}, key);
      }
    });

    it('readOneFcd', async () => {
        await cr.readOneFcd('0x4500000000000000000000000000000000000000000000000000000000000000');
    });
  });
});
