import {use, expect} from 'chai';
import {Contract, ContractFactory, Signer} from 'ethers';
import {waffleChai} from '@ethereum-waffle/chai';
import {deployMockContract} from '@ethereum-waffle/mock-contract';
import {loadFixture} from 'ethereum-waffle';
import Registry from '../../artifacts/contracts/Registry.sol/Registry.json';
import StakingBank from '../../artifacts/contracts/StakingBank.sol/StakingBank.json';
import Token from '../../artifacts/contracts/Token.sol/Token.json';
import {toBytes32} from '../../scripts/utils/helpers';

use(waffleChai);

async function fixture([owner]: Signer[]) {
  const contractRegistry = await deployMockContract(owner, Registry.abi);
  const token = await deployMockContract(owner, Token.abi);
  const contractFactory = new ContractFactory(StakingBank.abi, StakingBank.bytecode, owner);

  await token.mock.name.returns('abc');
  await token.mock.symbol.returns('abc');

  const contract = await contractFactory.deploy(contractRegistry.address, 'Umbrella', 'UMB');

  return {
    contract
  };
}

describe('StakingBank', () => {
  let contract: Contract;

  beforeEach(async () => {
    ({contract} = await loadFixture(fixture));
  });

  describe('when deployed', () => {
    it('expect to have token', async () => {
      expect(await contract.getName()).to.eq(toBytes32('StakingBank'));
    });
  });
});
