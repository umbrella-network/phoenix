# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## Unreleased

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
