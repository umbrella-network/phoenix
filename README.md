# phoenix
A delegated proof-of-authority contract for minting sidechain blocks.

## Overview
Each block is signed by a set of validators.
A minimum stake quorum must be achieved in order for a sidechain block to be mined.

- [Multichain docs](./MASTERCHAIN.md)
- [On-chain docs](./ON-CHAIN.md)

## Prerequisites

1. [brew](http://brew.sh)

```sh
ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
```

2. [HubFlow](http://datasift.github.io/gitflow/)

```sh
brew install hubflow
```

> If you are on Linux

```sh
git clone https://github.com/datasift/gitflow
cd gitflow
sudo ./install.sh
```

3. Foundry 

Install foundry on your machine: https://book.getfoundry.sh/getting-started/installation.html

In case on missing lib: `brew install libusb`.


---

## Setup

1. `git clone git@github.com:umbrella-network/phoenix.git`
2. `git hf init`
3. `npm install`
4. `git submodule update --init --recursive`
5. `git submodule add --name gitmodules/uniswap/v3-periphery https://github.com/Uniswap/v3-periphery gitmodules/uniswap/v3-periphery`

```
git submodule update --init --recursive
```
---

### Remove submodule

example:

```shell
# Remove the submodule entry from .git/config
git submodule deinit -f gitmodules/uniswap/v3-periphery

# Remove the submodule directory from the superproject's .git/modules directory
rm -rf .git/modules/gitmodules/uniswap/

# Remove the entry in .gitmodules and remove the submodule directory located at path/to/submodule
rm -rf gitmodules/uniswap/
```

## Testing

```
npm run test
forge test -vvv
```

---

## Development

### Local

1. Start Ganache or Hardhat

- ganache: `npx ganache-cli --blockTime 15`
- hardhat (recommended): `npm run node`
  for hardhat you can set minting options in env variables eg 
  - `HARDHAT_MINING_INTERVAL=1000` - this is block time 
  - `HARDHAT_MINING_AUTO=false` - this will simulate mainnet (you will have to wait block time seconds to mint tx)
2. Deploy to localhost

## Deployment scripts

[see new multichain architecture deployment steps](./MASTERCHAIN.md)

**Note:** we need to use `HARDHAT_NETWORK` until we deprecate all old scripts and configuration.

```shell
hardhat deploy --network <name>

HARDHAT_NETWORK=bsc_staging hardhat redeploy-homechain --network bsc_staging
```

For sidechain deployment you need `VALIDATOR_PK` to be setup in `.env`.
If you do not have it the script will throw error, but also generate random PK for you,
so you can copy it, set into env file and rerun command.

⚠️⚠️⚠️  
**NOTE: _N E V E R_  use this keys in mainnet! For mainnet use dedicated wallets to generate PK.**  
⚠️⚠️⚠️

### Live or Testnet
 
```shell
# HARDHAT_NETWORK: localhost | <blockchainId>_<environment> 
# eg: ethereum_staging, bsc_staging - see full list in `hardhat.config.ts`

HARDHAT_NETWORK=ethereum_staging npm run deploy:all
HARDHAT_NETWORK=bsc_staging npm run deploy:all
```

In case of any errors, please read error message. There should be some tips what's need to be fixed.

---

### Update contract

**NOTE**: in case script stuck on deployment, try to use another RPC endpoint

### Home Chain

#### New hardhat tasks

```
FORKING_ENV=bsc npx hardhat node --no-deploy --no-reset
npx hardhat redeploy-homechain
```

### Adding new validator

1. update staking bank static contract
   1. update `stakingBankStaticDeploymentData` 
   2. update `validatorsCount` in test case
   3. update list of validators in test `StaticBankStaticTest`
   4. `yarn test`
   5. `forge test -vvv`
2. run `./scripts/update-validators-prod.sh [step]`
   1. in case if verification errors, try with standard json
   `npx hardhat  standard-json --network avalanche_production --contract StakingBankStatic`
   and run script again
   2. steps: 1, 2, 3 (warning - removing files), 1 (again), 4, 5
   3. each step can fail because of various reasons, so repeat (or execute via Metamask)

### Old scripts

```shell
hardhat compile && HARDHAT_NETWORK= npx hardhat run ./scripts/reDeployToken.ts

hardhat compile && HARDHAT_NETWORK= npx hardhat run ./scripts/reDeployStakingBank.ts

hardhat compile && HARDHAT_NETWORK= npm run deploy:chain
hardhat compile && HARDHAT_NETWORK=bsc_staging npm run deploy:chain

hardhat compile && HARDHAT_NETWORK=bsc_staging npx hardhat run ./scripts/registerNewValidator.ts
```

### Multichain (deprecated)

#### EVM chains

Please see [this commit](https://github.com/umbrella-network/phoenix/commit/4185f543fc73a686a58c82aa20e4120060053320) 
for steps to adopt EVM compatible blockchain.

#### Foreign Chain (deprecated)

```shell
HARDHAT_NETWORK=<network_env> npm run deploy:all
HARDHAT_NETWORK=ethereum_staging npm run deploy:all
HARDHAT_NETWORK=polygon_staging npm run deploy:all
HARDHAT_NETWORK=avalanche_staging npm run deploy:all
HARDHAT_NETWORK=arbitrum_production npm run deploy:all
```

then:

```shell
hardhat compile && HARDHAT_NETWORK=ethereum_staging npm run deploy:foreignChain
hardhat compile && HARDHAT_NETWORK=ethereum_sandbox npm run deploy:foreignChain
hardhat compile && HARDHAT_NETWORK=avalanche_production npm run deploy:foreignChain
hardhat compile && HARDHAT_NETWORK=ethereum_production npm run deploy:foreignChain
```


### On-Chain data

#### Deployments

On blockchain where we do have L2 consensus:

```shell
npx hardhat deploy --network linea_production
npx hardhat registerStakingBankStatic --network linea_production
# just in case chain needs to be redeployed
# if staking bank changed, there might be need to force redeployment by removing deployment files for chain and feeds
npx hardhat deploy --network linea_production

npx hardhat registerChain --network linea_production

npx hardhat registerUmbrellaFeeds --destroy USDC-USD --network linea_production
npx hardhat registerReaderFactory --network linea_production
```

On blockchain with only on-chain data:

```shell
npx hardhat deploy --network bob_production

npx hardhat registerStakingBankStatic --network bob_production
# remove feed json
npx hardhat deploy --network bob_production

npx hardhat registerUmbrellaFeeds --destroy USDC-USD --network bob_production
npx hardhat registerUmbrellaFeeds --network bob_production
npx hardhat registerReaderFactory --network bob_production
```

#### Code verification on Linea

At the moment of developing hardhat verification not supporting linea, hardhat flattener was not working all the time.

Here are steps that seems to be working always:

```
# we need deploy to other network and verify code there

# UmbrellaFeedsReader
npx hardhat verify --network avalanche_staging 0x206953BAaEB74226D81059ffD67BC42f2cf8cF5f --constructor-args ./arguments.js
npx hardhat linea-verify --network avalanche_staging --address 0x206953BAaEB74226D81059ffD67BC42f2cf8cF5f --name UmbrellaFeedsReader

npx hardhat linea-verify --network avalanche_staging --name UmbrellaFeeds  
npx hardhat linea-verify --network avalanche_staging --name UmbrellaFeedsReaderFactory  
```

As result of `linea-verify`, stardard JSON file is created. Use it to verify contract on linea.

### Distributor

Only for testnets

```shell
hardhat compile && HARDHAT_NETWORK=polygon_staging npx hardhat run ./scripts/deployDistributor.ts
```

### Connect with validators for staging and testing

```shell
# start hardhat network with contracts
docker-compose up
```

```shell
# navigate to validator repo
cd ../pegasus

# start hardhat network with contracts
echo 'BLOCKCHAIN_PROVIDER_URL=http://eth:8545' >> .env
docker-compose up
```

## Licensed under MIT.

This code is licensed under MIT.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
