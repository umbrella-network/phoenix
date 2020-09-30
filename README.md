# phoenix
A delegated proof-of-stake contract for minting sidechain blocks.

## Overview
Each block is signed by a set of validators.
A minimum stake quorum must be achieved in order for a sidechain block to be minted.

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

1. `npx buidler test`

---

## Development

1. Start Ganache

`npx ganache-cli --blockTime 23`

2. Deploy to localhost

`npx buidler run ./scripts/deploy.js`

## Deploy

Use Remix to deploy.
Use `truffle-flattener` to flatten and make each contract deployable.

Example: 

`npx truffle-flattener ./contracts/ValidatorRegistry.sol | awk '/SPDX-License-Identifier/&&c++>0 {next} 1' | pbcopy`

Deploy in the following order:

- Token
- ValidatorRegistry
- StakingBank
- Chain

---

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
