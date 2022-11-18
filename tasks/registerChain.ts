import { task } from 'hardhat/config';
import { registerChain } from './_helpers/registerChain';

task('registerChain', 'chain contract registration').setAction(async (taskArgs, hre) => {
  await registerChain(hre);
});
