# Switching to MasterChain

## Local QA for ForeignChain with forking

1. `FORKING_ENV=eth FORKING_BLOCK_NUMBER=15522800 hardhat node`
2. Update Registry address in `deployments/localhost/Registry.json` to be the one from forked network
3. Remove deployment for chain and staking bank from `deployments/localhost/`. 
   This two contracts needs to be redeployed for new masterchain architecture.
4. `FAKE_MAINNET=1 hardhat deploy --network localhost` - this should deploy new contracts, removed above.
5. set `MASTER_CHAIN_NAME=bsc_staging` (it can be any chain)
6. Clone validators balances: `FAKE_MAINNET=1 hardhat clone-validators --network localhost`

## Development switch (staging)

1. set `MASTER_CHAIN_NAME=bsc_staging`
2. `mkdir -p deployments/<network>/`, where `<network>` is the target network (must be defined in hardhat config) eg:
   1. `polygon_staging`
   2. `avalanche_staging`
3. `cp deployments/bsc_staging/Registry.json deployments/<network>/`
4. Update Registry address in `deployments/<network>/Registry.json` to be the one from network
5. `touch deployments/<network>/.chainId` and set valid ID
6. Make sure `chainDeploymentData` has config for `<network>`
7. `MASTER_CHAIN_NAME=bsc_staging hardhat deploy --network <network>` - this should deploy chain and staking bank state contracts.
7. `MASTER_CHAIN_NAME=bsc_staging hardhat deploy --network bsc_staging` - this should deploy chain and staking bank state contracts.
8. Clone validators balances: `hardhat clone-validators --network <network>`

### Sandbox

```shell
FAKE_MAINNET=1 FORKING_BLOCK_NUMBER=22374090 FORKING_ENV=bnb npx hardhat node --no-deploy
FAKE_MAINNET=1 FORKING_ENV=bnb npx hardhat node --no-deploy

# update Registry address in deployments/localhost/Registry.json to be the one from mainnet
# see config/ for current addresses 

FAKE_MAINNET=1 hardhat deploy --network bnb_production
FAKE_MAINNET=1 npx hardhat registerChain --network bnb_production
```

### Sandbox switch

```shell
npx hardhat deploy --network polygon_sandbox
npx hardhat clone-validators --master-chain-name bnb_sandbox --network polygon_sandbox
npx hardhat registerChain --network polygon_sandbox
FAKE_MAINNET=1 npx hardhat registerChain --network bnb_production
```

### Production switch

```shell
npx hardhat deploy --network avalanche_production
npx hardhat clone-validators --master-chain-name bnb_production --network avalanche_production
npx hardhat registerChain --network avalanche_production
```
