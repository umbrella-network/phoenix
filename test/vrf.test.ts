import {prove, proofToHash, verify, nonceGeneration} from '@roamin/ecvrf';
import elliptic from 'elliptic';
import {expect, use} from 'chai';

import {waffleChai} from '@ethereum-waffle/chai';

use(waffleChai);


describe('VRF', () => {
  it.only('generate VRF', () => {
    const EC = new elliptic.ec('secp256k1');

    const SECRET = EC.keyPair({priv: 'c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721', privEnc: 'hex'});

    const msg = Buffer.from(Math.random().toString(10)).toString('hex');

    // VRF proof and hash output
    const proof = prove(SECRET.getPrivate('hex'), msg);
    const hash = proofToHash(proof);

    // VRF proof verification (returns VRF hash output)
    const beta = verify(SECRET.getPublic('hex'), proof, msg);

    const nonce = nonceGeneration(SECRET.getPrivate(), Buffer.from(msg, 'hex'));

    console.log({SECRET, proof, hash, msg: msg.toString(), nonce: nonce.toString('hex')});

    expect(hash).eq(beta);
  });
});
