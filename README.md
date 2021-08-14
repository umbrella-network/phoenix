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
For sidechain deployment you need `VALIDATOR_PK` to be setup in `.env*`.
If you do not have it the script will throw error, but also generate random PK for you,
so you can copy it, set into env file and rerun command.

⚠️⚠️⚠️  
**NOTE: _N E V E R_  use this keys in mainnet! For mainnet use dedicated wallets to generate PK.**  
⚠️⚠️⚠️

If you choose hardhat node, then you can use minter for mining blocks - hardhat not minting automatically:

```shell
npm run local-minter
```

### Live or Test nets

Setup Infura ID (every service has dedicated ID, use the one for `deployments` - see infura dashboard) in .env and run:

```shell
npm run deploy:all:[staging|sandbox|production]
```

In case of any errors, please read error message. There should be some tips what's need to be fixed.

---

### Update contract

**NOTE**: in case script stuck on deployment, try to use another RPC endpoint

```shell
hardhat compile && npx hardhat run --network localhost ./scripts/reDeployToken.ts
hardhat compile && NODE_ENV=staging npx hardhat run --network staging ./scripts/reDeployToken.ts
hardhat compile && NODE_ENV=sandbox npx hardhat run --network sandbox ./scripts/reDeployToken.ts
hardhat compile && NODE_ENV=production npx hardhat run --network production ./scripts/reDeployToken.ts

hardhat compile && npx hardhat run --network localhost ./scripts/reDeployStakingBank.ts
hardhat compile && NODE_ENV=staging npx hardhat run --network staging ./scripts/reDeployStakingBank.ts
hardhat compile && NODE_ENV=sandbox npx hardhat run --network sandbox ./scripts/reDeployStakingBank.ts
hardhat compile && NODE_ENV=production npx hardhat run --network production ./scripts/reDeployStakingBank.ts

hardhat compile && npx hardhat run --network localhost ./scripts/deployChain.ts
hardhat compile && NODE_ENV=staging npx hardhat run --network staging ./scripts/deployChain.ts
hardhat compile && NODE_ENV=sandbox npx hardhat run --network sandbox ./scripts/deployChain.ts
hardhat compile && NODE_ENV=production npx hardhat run --network production ./scripts/deployChain.ts

hardhat compile && NODE_ENV=staging npx hardhat run --network staging ./scripts/registerNewValidator.ts
hardhat compile && NODE_ENV=sandbox npx hardhat run --network sandbox ./scripts/registerNewValidator.ts
hardhat compile && NODE_ENV=production npx hardhat run --network production ./scripts/registerNewValidator.ts
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

## TODO

- [ ] Validator Rewards
  - [link](https://github.com/umbrella-network/phoenix/pull/1/files#r496632272)
- [ ] Robust Leader Selection 
  - [link](https://github.com/umbrella-network/phoenix/pull/1/files#r496607598)
  - [link](https://github.com/umbrella-network/phoenix/pull/1/files#r495886523)

## Licensed under MIT.

This code is licensed under MIT.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
