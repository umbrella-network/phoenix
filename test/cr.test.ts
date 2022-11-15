import 'hardhat';
import '@nomiclabs/hardhat-ethers';

import hre from 'hardhat';
import {use} from 'chai';
import {ethers, Wallet, Signer, ContractFactory} from 'ethers';
import {waffleChai} from '@ethereum-waffle/chai';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';

import {doSnapshot, revertSnapshot, sleep} from '../scripts/utils/helpers';
import {abiUintEncoder, sortWallets} from './chainUtils';
import {SubmitPreparedData} from '../types/types';
import {CR, CR__factory, CRbank, CRbank__factory} from '../typechain';

use(waffleChai);

const allValidators: Wallet[] = [];
const requiredSignatures = 5;

for (let i = 0; i < requiredSignatures; i++) {
  const wallet = ethers.Wallet.createRandom();
  allValidators.push(wallet);
}

const prepareData = async (args: {
  signer: Signer | Wallet;
  dataTimestamp: number;
  fcdKeys: string[];
  fcdValues: (number | string)[];
}): Promise<SubmitPreparedData> => {
  const {dataTimestamp, fcdValues, fcdKeys, signer} = args;

  let testimony = '0x' + abiUintEncoder(dataTimestamp, 32);

  for (let i = 0; i < fcdKeys.length; i++) {
    if (typeof fcdValues[i] === 'string' && !ethers.utils.isHexString(fcdValues[i])) {
      throw Error(`if FCD is a string, then must be hex string: ${fcdValues[i]}`);
    }

    testimony += fcdKeys[i].replace('0x', '') + abiUintEncoder(fcdValues[i]);
  }

  const hashForSolidity = ethers.utils.keccak256(testimony);

  return {
    ...(await signHash(signer, hashForSolidity)),
    hashForSolidity,
    dataTimestamp,
    testimony
  };
};


const signHash = async (signer: Signer | Wallet, hashForSolidity: string): Promise<{
  affidavit: Uint8Array;
  sig: string;
  r: string;
  s: string;
  v: number;
}> => {
  const affidavit = ethers.utils.arrayify(hashForSolidity);

  const sig = await signer.signMessage(affidavit);
  const {r, s, v} = ethers.utils.splitSignature(sig);

  return {affidavit, sig, r, s, v};
};

const randomData = async (id?: number) => {
  const dataTimestamp = Math.trunc(Date.now() / 1000);
  const sorted = sortWallets(allValidators);

  const vv: number[] = [];
  const rr: string[] = [];
  const ss: string[] = [];

  const key = id ? '0x' + (id.toString(16)).padStart(64, '0') : '0x45'.padEnd(66, '0');
  const value = Math.trunc(Math.random() * 100000000) + 1;

  for (const participant of sorted) {
    const {r, s, v} = await prepareData({
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


const randomFCDS = async () => {
  const dataTimestamp = Math.trunc(Date.now() / 1000);
  console.log('generating FCDSS', dataTimestamp);
  let fcds = '0x';

  for (let i = 0; i < 3; i++) {
    fcds += abiUintEncoder(Math.trunc(Math.random() * 100000000) + 1, 64);
  }

  fcds += abiUintEncoder(dataTimestamp, 64);

  const sorted = sortWallets(allValidators);

  const vv: number[] = [];
  const rr: string[] = [];
  const ss: string[] = [];

  for (const participant of sorted) {
    const {r, s, v} = await signHash(participant, fcds);

    vv.push(v);
    rr.push(r);
    ss.push(s);
  }

  return {dataTimestamp, key: '', value: fcds, vv, rr, ss};
};

const randomFCDSWithKey = async (key: string) => {
  const dataTimestamp = Math.trunc(Date.now() / 1000);
  console.log('generating FCDSS', dataTimestamp);
  key = '0x' + abiUintEncoder(key);
  let fcds = '0x';

  for (let i = 0; i < 3; i++) {
    fcds += abiUintEncoder(Math.trunc(Math.random() * 100000000) + 1, 64);
  }

  fcds += abiUintEncoder(dataTimestamp, 64);

  const hashForSolidity = ethers.utils.keccak256(`${key}${fcds.slice(2)}`);
  const sorted = sortWallets(allValidators);

  const vv: number[] = [];
  const rr: string[] = [];
  const ss: string[] = [];

  for (const participant of sorted) {
    const {r, s, v} = await signHash(participant, hashForSolidity);

    vv.push(v);
    rr.push(r);
    ss.push(s);
  }

  return {dataTimestamp, key, value: fcds, vv, rr, ss};
};

describe.only('CR', () => {
  let owner: SignerWithAddress;
  let cr: CR;
  let bank: CRbank;

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

      const BankArtifacts = await hre.artifacts.readArtifact('CRbank');
      const bankFactory = new ContractFactory(BankArtifacts.abi, BankArtifacts.bytecode, owner);
      const bankContract = await bankFactory.deploy();
      bank = CRbank__factory.connect(bankContract.address, owner);

      const CRArtifacts = await hre.artifacts.readArtifact('CR');
      const contractFactory = new ContractFactory(CRArtifacts.abi, CRArtifacts.bytecode, owner);
      const contract = await contractFactory.deploy(bank.address, allValidators.map(v => v.address));
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


    it('submitOneSquashedFcd', async () => {
      let i = 5;

      while (i-- > 0) {
        const randomId = Math.trunc(Math.random() * 8 + 1);
        const {dataTimestamp, key, value, vv, rr, ss} = await randomData(randomId);

        const tx = await cr.submitOneSquashedFcd(dataTimestamp, key, value, vv, rr, ss);
        const receipt = await tx.wait(1);
        const gas = receipt.cumulativeGasUsed.toBigInt();
        console.log({gas, value, signatures: rr.length}, key);

        console.log(await cr.fcdsS());
      }
    });

    it('submitAllSquashedFcd', async () => {
      let i = 5;
      console.log('INITIAL', await cr.fcdsS());

      console.log('INITIAL RAW', await owner.call({
        to: cr.address,
        value: 0,
        data: hre.ethers.utils.id('fcdsS()').slice(0, 10)
      }));

      await bank.saveBalance(allValidators.map(w => w.address));

      while (i-- > 0) {
        const {key, value, vv, rr, ss} = await randomFCDS('abc');

        console.log(value, (await cr.exctractTime(value)).toString(10));

        const tx = await cr.submitAllSquashedFcd(value, vv, rr, ss);
        const receipt = await tx.wait(1);
        const gas = receipt.cumulativeGasUsed.toBigInt();
        console.log({gas, value, signatures: rr.length}, key);

        console.log(await cr.fcdsS());
        await sleep(1200);
      }
    });

    it.only('submitAllSquashedFcdMap', async () => {
      let i = 5;
      console.log('INITIAL', await cr.fcdsS());

      console.log('INITIAL RAW', await owner.call({
        to: cr.address,
        value: 0,
        data: hre.ethers.utils.id('fcdsS()').slice(0, 10)
      }));

      await bank.saveBalance(allValidators.map(w => w.address));

      while (i-- > 0) {
        const {key, value, vv, rr, ss} = await randomFCDSWithKey('abc');

        console.log(value, (await cr.exctractTime(value)).toString(10));

        const tx = await cr.submitAllSquashedFcdMap(key, value, vv, rr, ss);
        const receipt = await tx.wait(1);
        const gas = receipt.cumulativeGasUsed.toBigInt();
        console.log({gas, value, signatures: rr.length}, key);

        console.log(await cr.fcdsS());
        // console.log(await cr.extractValue(1));
        // console.log(await cr.fcdsMap(key));
        await sleep(1200);
      }
    });
  });
});
