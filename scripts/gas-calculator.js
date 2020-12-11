const bre = require('@nomiclabs/buidler');
const {VALIDATOR_PK, CHAIN_CONTRACT_ADDRESS, GAS_PRICE_GWEI, ETH_PRICE_USD} = process.env;

const {Contract} = bre.ethers;
const { toBN, fromWei, toWei } = bre.web3.utils;

const {intToBuffer, toBytes32, string2buffer} = require('./helpers');
const SortedMerkleTree = require('../lib/SortedMerkleTree');
const {getProvider, waitForTx, mineBlock} = require('./helpers');

const prepareData = async (signer, blockHeight, root, fcdKeys = [], fcdValues = []) => {
  let testimony = ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes32'], [blockHeight, root]);

  for (let i = 0; i < fcdKeys.length; i++) {
    testimony += ethers.utils.defaultAbiCoder.encode(['bytes32', 'uint256'], [fcdKeys[i], fcdValues[i]]).slice(2);
  }

  const hashForSolidity = ethers.utils.keccak256(testimony);
  const affidavit = ethers.utils.arrayify(hashForSolidity);

  const sig = await signer.signMessage(affidavit);
  const {r, s, v} = ethers.utils.splitSignature(sig);

  return {testimony, affidavit, sig, r, s, v, hashForSolidity};
};

const provider = getProvider();

const submitReport = [];
const proofValidationReport = [];
const fcdMultiReport = [];
const fcdSingleReport = [];
const vanilaTxReport = [];

const addGasReportForSubmit = (firstClassDataCount, gasUsed) => {
  submitReport.push({firstClassDataCount, gasUsed});
};

const addGasReportForProofValidation = (leavesCount, hashesToDo, keysCount, gasUsed) => {
  proofValidationReport.push({leavesCount, hashesToDo, keysCount, gasUsed});
};

const addGasReportForMultiFCDRead = (keysCount, gasUsed) => {
  fcdMultiReport.push({keysCount, gasUsed});
};

const addGasReportForSingleFCDRead = (keysCount, gasUsed) => {
  fcdSingleReport.push({keysCount, gasUsed});
};

const setupTree = leavesCount => {
  const inputs = {};

  for (let i=0; i < leavesCount; i++) {
    inputs[`input${i}`] = intToBuffer(i);
  }

  return new SortedMerkleTree(inputs);
};

const setupChain = () => {
  const Chain = require('../artifacts/Chain');
  return new Contract(CHAIN_CONTRACT_ADDRESS, Chain.abi, provider);
};

const setupUser = async () => {
  const UserContract = await ethers.getContractFactory('User');
  const user = await UserContract.deploy(CHAIN_CONTRACT_ADDRESS);
  return user.deployed();
};

let user;

async function gasForSubmit(leavesCount = 1, keys = [], values = []) {
  // const [owner] = await ethers.getSigners();
  const validator = new ethers.Wallet(VALIDATOR_PK, provider);
  const chain = setupChain();
  const tree = setupTree(leavesCount);
  const root = tree.getHexRoot();
  const blockHeight = (await chain.getBlockHeight()).toString();

  const {r, s, v} = await prepareData(validator, blockHeight, root, keys, values);
  const tx = await chain.connect(validator).submit(root, keys, values, [v], [r], [s]);

  const receipt = await waitForTx(tx.hash, provider);
  // console.log(receipt);

  addGasReportForSubmit(keys.length, receipt.gasUsed.toString());

  // eslint-disable-next-line no-constant-condition
  while ((await chain.getBlockHeight()).toString() === blockHeight) {
    await mineBlock();
  }

  return {blockHeight, tree};
}

async function calcGasForFCDRead(blockHeight, keys = []) {
  const tx = await user.fcd(blockHeight, keys);
  const receipt = await waitForTx(tx.hash, provider);
  addGasReportForMultiFCDRead(keys.length, receipt.gasUsed.toString());

  if (keys.length) {
    const tx = await user.fcdOne(blockHeight, keys[0]);
    const receipt = await waitForTx(tx.hash, provider);
    addGasReportForSingleFCDRead('single key', receipt.gasUsed.toString());
  }
}

async function calcGasForVanilaTx(blockHeight, keys = []) {
  const tx = await user.tx();
  const receipt = await waitForTx(tx.hash, provider);
  vanilaTxReport.push({type: 'valina tx', gasUsed: receipt.gasUsed.toString()})
}

async function calcGasForProofValidation(blockHeight, tree, key = 'input0', value = 1) {
  const proof = tree.getProofForKey(key);
  const keyBytes = string2buffer(key);
  const valueBytes = intToBuffer(value);
  const tx = await user.umbrellaValidation(blockHeight, proof, keyBytes, valueBytes);
  //const tx = await user.tx();

  const receipt = await waitForTx(tx.hash, provider);

  addGasReportForProofValidation(tree.getLeaves().length, proof.length + 1, 1, receipt.gasUsed.toString());
}

const calcCost = (gasUsed) => {
  const gasPriceWei = toWei(GAS_PRICE_GWEI, 'Gwei');
  const ethPrice = parseFloat(ETH_PRICE_USD);

  const gasPrice = toBN(gasUsed).mul(toBN(gasPriceWei));
  const gasPriceEth = parseFloat(fromWei(gasPrice.toString(10), 'ether'));
  const fee = gasPriceEth * ethPrice;

  return {gasPrice, gasPriceEth, fee};
};

const printReport = () => {
  const gasPriceWei = toWei(GAS_PRICE_GWEI, 'Gwei');
  const ethPrice = parseFloat(ETH_PRICE_USD);

  console.log('gas price:', fromWei(gasPriceWei, 'Gwei'), 'Gwei');
  console.log('ETH price:', ethPrice.toString(), 'USD');


  console.log('---------- SUBMIT COST');

  submitReport.forEach(item => {
    const {gasPriceEth, fee} = calcCost(item.gasUsed);

    console.log(
      'FCD count:', item.firstClassDataCount,
      'gas used:', item.gasUsed,
      'gas price ETH:', gasPriceEth,
      'fee USD:', Math.round(fee * 100) / 100,
      'fee USD/mo (5min block):', Math.round(60 / 5 * 24 * 30 * fee)
    );
  });

  console.log('---------- PROOF VALIDATION COST');

  proofValidationReport.forEach(item => {
    const {gasPriceEth, fee} = calcCost(item.gasUsed);

    console.log(
      'leaves count:', item.leavesCount,
      'hashes count:', item.hashesToDo,
      'keys count:', item.keysCount,
      'gas used:', item.gasUsed,
      'gas price ETH:', gasPriceEth,
      'fee USD:', Math.round(fee * 100) / 100,
    );
  });

  console.log('---------- FCD READ (multiple keys) COST');

  fcdMultiReport.forEach(item => {
    const {gasPriceEth, fee} = calcCost(item.gasUsed);

    console.log(
      'keys count:', item.keysCount,
      'gas used:', item.gasUsed,
      'gas price ETH:', gasPriceEth,
      'fee USD:', Math.round(fee * 100) / 100,
    );
  });


  console.log('---------- FCD READ (single key) COST');

  fcdSingleReport.forEach(item => {
    const {gasPriceEth, fee} = calcCost(item.gasUsed);

    console.log(
      'keys count:', item.keysCount,
      'gas used:', item.gasUsed,
      'gas price ETH:', gasPriceEth,
      'fee USD:', Math.round(fee * 100) / 100,
    );
  });

  console.log('---------- VANILA TX COST');

  vanilaTxReport.forEach(item => {
    const {gasPriceEth, fee} = calcCost(item.gasUsed);

    console.log(
      'keys count:', item.type,
      'gas used:', item.gasUsed,
      'gas price ETH:', gasPriceEth,
      'fee USD:', Math.round(fee * 100) / 100,
    );
  });
};

async function verifyProofs() {
  const {tree, blockHeight} = await gasForSubmit(50);

  const keys = Object.keys(tree.keys).slice(0, 10);
  const blockHeights = new Array(keys.length).fill(blockHeight);
  const {proofs, proofItemsCounter} = tree.getFlatProofsForKeys(keys);
  const leaves = keys.map(k => tree.getLeafForKey(k));

  const tx = await user.verifyProofs(blockHeights, proofs, proofItemsCounter, leaves);
  const receipt = await waitForTx(tx.hash, provider);

  const hashes = proofItemsCounter.reduce((acc, v) => acc + v);

  addGasReportForProofValidation(
    tree.getLeaves().length,
    hashes + proofItemsCounter.length,
    keys.length,
    receipt.gasUsed.toString());
}

async function main() {
  user = await setupUser();
  let submitted;

  await verifyProofs();

  submitted = await gasForSubmit(10000);
  await calcGasForProofValidation(submitted.blockHeight, submitted.tree, 'input200', 200);

  submitted = await gasForSubmit(100, [toBytes32('1')], [toBytes32('2')]);
  await calcGasForProofValidation(submitted.blockHeight, submitted.tree, 'input11', 11);

  submitted = await gasForSubmit(
    1,
    [1,2,3,4,5,6,7,8,9,10].map(v => toBytes32(v.toString())),
    [1,2,3,4,5,6,7,8,9,10].map(v => v.toString())
  );

  await calcGasForProofValidation(submitted.blockHeight, submitted.tree, 'input0', 0);

  await calcGasForFCDRead(submitted.blockHeight, []);
  await calcGasForFCDRead(submitted.blockHeight, [toBytes32('1')]);
  await calcGasForFCDRead(submitted.blockHeight, [toBytes32('1'), toBytes32('2')]);

  await calcGasForVanilaTx();

  printReport();
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
