# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## Unreleased
### Added
- `Distributor` contract
- Avalanche support

### Removed
- local minter, as hardhat can finally mint

## [4.2.0] - 2021-10-18
### Added
- Polygon support

## [4.1.1] - 2021-10-11
### Changed
- set 1h as default padding for ETH prod in settings

## [4.1.0] - 2021-10-08
### Changed
- squash root and timestamp to save gas (version with backwards compatibility)

## [4.0.0] - 2021-10-04
### Added
- Foreign Chain
- `Registry` contract has additional method `atomicUpdate`

### Changed
- redeployment process for `ForeignChain` is different from `Chain`

## [3.2.0] - 2021-08-31
### Changed
- turn off power until we have proper DPoS
- update readme with sandbox commands

## [3.1.0] - 2021-08-11
### Changed
- optimise gas by making some states immutable

### Removed
- affidavit from `Block` struct

## [3.0.0] - 2021-08-10
### Added
- add requirement for number of signatures

### Changed
- merge `StakingBank` and `ValidatorRegistry`

## [2.0.7] - 2021-07-13
### Fixed
- fix code verification contract 

## [2.0.6] - 2021-07-13
### Added 
- support sandbox environment

## [2.0.5] - 2021-07-12
### Removed
- temporary remove condition about submitting block with future timestamp

## [2.0.4] - 2021-07-06
### Changed
- adjust range for future timestamp 

## [2.0.3] - 2021-07-01
### Fixed
- Ensure that `getStatus()` returns `nextBlockId` and `nextLeader` for same timestamp

## [2.0.2] - 2021-06-30
### Changed
- deploy new contract registry on BSC mainnet 

## [2.0.1] - 2021-06-10
### Changed
- adjust deployment process to support custom token

## [2.0.0] - 2021-05-24

### Changed
- use `uint32` for `dataTimestamp`
- remove FCD from block and save only last values
- storage optimisation
- use merkle tree library from SDK

### Removed
- remove `LeafDecoder`

## [1.0.3] - 2021-04-24
### Fixed
- ensure `getLeaderIndex` uses padding in right way

## [1.0.2] - 2021-04-19
### Fixed
- `getStatus` returns valid next `blockHeight`

## [1.0.1] - 2021-04-16
### Changed
- remove requirements for `block.timestamp` as we can't rely on miners timestamp

## [1.0.0] - 2021-04-15
### Added
- status getter that will return all needed data 

### Changed
- included `dataTimestamp` as part of validator signature

## [0.5.0] - 2021-04-07
### Changed
- submit will not throw on cases that not affects consensus validation eg invalid balance
- do not check if submit is done by leader
- do not stop when enough power gathered, save all signatures

## [0.4.0] - 2021-04-01
### Added
- check leader for block

## [0.3.0] - 2021-03-15
### Added
- option to remove validator + update scripts

### Fixed
- cycle leader selection

## [0.2.0] - 2021-03-10
### Added
- individual script for deploy/update `Chain`
- getters that allow access `Block` data for external calls

### Fixed
- new contract uses offset for block count, so we can preserve `blockHeight`

## [0.1.0] - 2021-02-25
### Added
- initial version
- contracts interfaces
- first class chain data
- proof validation on-chain
- getters for `Chain.blocks`
- numeric first class data
- helpers functions to decode int and float from leaf bytes
- verify source via Etherscan API

### Changed
- `StakingBank` to be `ERC20` compatible
- make Chain states: `validatorRegistry`, `stakingBank`, `interval` to be public
- replace sparse merkle tree with sorted merkle tree
- sort leaves keys in merkle tree
- use coders from `@umb-network/toolbox` in tests
- changed how block is mine: use `blockPadding` instead of `interval`
- switch to TS
