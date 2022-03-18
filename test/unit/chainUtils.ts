import { ethers } from 'hardhat';
import { Signer } from 'ethers';
import { LeafValueCoder, constants as SDKConstants } from '@umb-network/toolbox';
import { remove0x } from '@umb-network/toolbox/dist/utils/helpers';

import SortedMerkleTree from '../../lib/SortedMerkleTree';

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
  signer: Signer,
  dataTimestamp: number,
  root: string | null,
  fcdKeys: string[] = [],
  fcdValues: (number | string)[] = []
): Promise<{
  testimony: string;
  affidavit: Uint8Array;
  sig: string;
  r: string;
  s: string;
  v: number;
  hashForSolidity: string;
  dataTimestamp: number;
}> => {
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
