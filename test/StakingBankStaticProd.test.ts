import { artifacts } from 'hardhat';
import { expect, use } from 'chai';

import { ContractFactory, Contract, Wallet } from 'ethers';
import { waffleChai } from '@ethereum-waffle/chai';
import { loadFixture } from 'ethereum-waffle';

import { resolveValidatorInfo } from '../scripts/registerNewValidator';

use(waffleChai);

const StakingBankStaticProd = artifacts.readArtifactSync('StakingBankStaticProd');
const validatorsCount = 15;

async function fixture([owner]: Wallet[]): Promise<{
  contract: Contract;
}> {
  const contractFactory = new ContractFactory(StakingBankStaticProd.abi, StakingBankStaticProd.bytecode, owner);
  const contract = await contractFactory.deploy(validatorsCount);

  return {
    contract,
  };
}

describe.only('StakingBankStaticProd', () => {
  let contract: Contract;

  before(async () => {
    ({ contract } = await loadFixture(fixture));
  });

  it(`expect to have ${validatorsCount} validators`, async () => {
    expect(await contract.getNumberOfValidators()).to.eq(validatorsCount);
  });

  describe('cross check all validators', () => {
    const arr = new Array(validatorsCount).fill(0);

    console.log(arr);

    arr.forEach((n, i) => {
      it(`[${i}] validator check`, async () => {
        const address = await contract.addresses(i);
        const validator = await contract.validators(address);
        const info = await resolveValidatorInfo(validator.location);

        expect(info.validator).to.equal(address);
      });
    });
  });
});
