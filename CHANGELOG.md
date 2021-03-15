# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## Unreleased
### Added
- option to remove validator + update scripts

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
