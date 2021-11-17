# phoenix
A delegated proof-of-stake contract for minting sidechain blocks.

## Overview
Each block is signed by a set of validators.
A minimum stake quorum must be achieved in order for a sidechain block to be mined.

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

---

## Setup

1. `git clone git@github.com:umbrella-network/phoenix.git`
2. `git hf init`
3. `npm install`

---

## Testing

1. `npm run test`

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

```shell script
npm run deploy:all
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

```shell
hardhat compile && HARDHAT_NETWORK= npx hardhat run ./scripts/reDeployToken.ts

hardhat compile && HARDHAT_NETWORK= npx hardhat run ./scripts/reDeployStakingBank.ts

hardhat compile && HARDHAT_NETWORK= npm run deploy:chain

hardhat compile && HARDHAT_NETWORK= npx hardhat run ./scripts/registerNewValidator.ts
```

### Multichain

#### EVM chains

Please see [this commit](https://github.com/umbrella-network/phoenix/commit/02b2fc2c4e1f408d6fd57676632476023ad3f00b) 
for steps to adopt EVM compatible blockchain.

#### Foreign Chain

```shell
HARDHAT_NETWORK=<network_env> npm run deploy:all
HARDHAT_NETWORK=ethereum_staging npm run deploy:all
HARDHAT_NETWORK=polygon_staging npm run deploy:all
HARDHAT_NETWORK=avalanche_staging npm run deploy:all
HARDHAT_NETWORK=avalanche_production npm run deploy:all
```

then:

```shell
hardhat compile && HARDHAT_NETWORK=ethereum_staging npm run deploy:foreignChain
hardhat compile && HARDHAT_NETWORK=ethereum_sandbox npm run deploy:foreignChain
hardhat compile && HARDHAT_NETWORK=avalanche_production npm run deploy:foreignChain
hardhat compile && HARDHAT_NETWORK=ethereum_production npm run deploy:foreignChain
```


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

## Toubleshoot for avalanche

In order to make hardhat work with avalanche, please edit this file:

`node_modules/@nomiclabs/hardhat-etherscan/dist/src/network/prober.js`

```aidl
    NetworkID[NetworkID["AVALANCHE"] = 43114] = "AVALANCHE";
    NetworkID[NetworkID["AVALANCHE_FUJI_TESTNET"] = 43113] = "AVALANCHE_FUJI_TESTNET";

    [NetworkID.AVALANCHE]: {
        apiURL: "https://api.snowtrace.io/api",
        browserURL: "https://snowtrace.io/",
    },
    [NetworkID.AVALANCHE_FUJI_TESTNET]: {
        apiURL: "https://api-testnet.snowtrace.io/api",
        browserURL: "https://testnet.snowtrace.io/",
    },
```

## Licensed under MIT.

This code is licensed under MIT.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
