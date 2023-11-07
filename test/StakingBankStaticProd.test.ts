import { artifacts } from 'hardhat';
import { expect, use } from 'chai';

import { ContractFactory, Contract, Wallet, ethers } from 'ethers';
import { waffleChai } from '@ethereum-waffle/chai';
import { loadFixture } from 'ethereum-waffle';

import { resolveValidatorInfo, ValidatorInfo, ValidatorInfoV2 } from '../scripts/registerNewValidator';
import { Validator } from '../types/types';

use(waffleChai);

const StakingBankStaticProd = artifacts.readArtifactSync('StakingBankStaticProd');
const validatorsCount = 19;

async function fixture([owner]: Wallet[]): Promise<{
  contract: Contract;
}> {
  const contractFactory = new ContractFactory(StakingBankStaticProd.abi, StakingBankStaticProd.bytecode, owner);
  const contract = await contractFactory.deploy(validatorsCount);

  return {
    contract,
  };
}

describe('StakingBankStaticProd', () => {
  let contract: Contract;

  beforeEach(async () => {
    ({ contract } = await loadFixture(fixture));
  });

  it(`expect to have ${validatorsCount} validators`, async () => {
    expect(await contract.getNumberOfValidators()).to.eq(validatorsCount);
  });

  it('invalid address check', async () => {
    expect(() => contract.addresses(validatorsCount)).throw;
  });

  it('invalid validators check', async () => {
    const validator: Validator = await contract.validators(contract.address);

    expect(validator.id).eq(ethers.constants.AddressZero);
    expect(validator.location).eq('');
  });

  describe('cross check all validators', () => {
    const arr = new Array(validatorsCount).fill(0);

    console.log(arr);

    arr.forEach((n, i) => {
      it(`[${i}] validator check`, async () => {
        const address = await contract.addresses(i);
        const validator = await contract.validators(address);
        const info = await resolveValidatorInfo(validator.location);

        expect((info as ValidatorInfo).validator || (info as ValidatorInfoV2).chains.avax.walletAddress).to.equal(
          address
        );
      });
    });
  });
});
