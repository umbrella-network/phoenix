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
# eg: ethereum_staging, bsc_staging

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

### Foreign Chain

```shell
HARDHAT_NETWORK=<network_env> npm run deploy:all
HARDHAT_NETWORK=ethereum_staging npm run deploy:all
```

then:

```shell
hardhat compile && HARDHAT_NETWORK=ethereum_staging npm run deploy:foreignChain
hardhat compile && HARDHAT_NETWORK=ethereum_sandbox npm run deploy:foreignChain
hardhat compile && HARDHAT_NETWORK=ethereum_production npm run deploy:foreignChain
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

Chain.submit cost down by 15% - 20%
ForeignChain.submit cost down by 18% - 30% 

verifyProofForBlock up by 0.216% - 0.422%

before:

|  Chain     ·  submit               ·      109454  ·     159360  ·     120176  ·           34  ·          -  │
·············|·······················|··············|·············|·············|···············|··············
|  Chain     ·  verifyProofForBlock  ·           -  ·          -  ·      33354  ·            2  ·          -  │
·············|·······················|··············|·············|·············|···············|··············
|  Chain     ·  verifyProofs         ·           -  ·          -  ·      51210  ·            1  ·          -  │

|  ForeignChain  ·  submit               ·       73413  ·     125043  ·      88164  ·           26  ·          -  │
·················|·······················|··············|·············|·············|···············|··············
|  ForeignChain  ·  verifyProofForBlock  ·       30723  ·      33299  ·      32436  ·            3  ·          -  │
·················|·······················|··············|·············|·············|···············|··············
|  ForeignChain  ·  verifyProofs         ·           -  ·          -  ·      51210  ·            1  ·          -  │


and for squashed root:


|  Chain     ·  submit               ·       87062  ·     136955  ·      97787  ·           34  ·          -  │
·············|·······················|··············|·············|·············|···············|··············
|  Chain     ·  verifyProofForBlock  ·           -  ·          -  ·      33426  ·            2  ·          -  │
·············|·······················|··············|·············|·············|···············|··············
|  Chain     ·  verifyProofs         ·           -  ·          -  ·      51426  ·            1  ·          -  │

|  ForeignChain  ·  submit               ·       51126  ·     102756  ·      65877  ·           26  ·          -  │
·················|·······················|··············|·············|·············|···············|··············
|  ForeignChain  ·  verifyProofForBlock  ·       33359  ·      33371  ·      33363  ·            3  ·          -  │
·················|·······················|··············|·············|·············|···············|··············
|  ForeignChain  ·  verifyProofs         ·           -  ·          -  ·      51426  ·            1  ·          -  │


submit cost 