# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## Unreleased
### Added
- initial version
- contracts interfaces
- first class chain data
- proof validation on-chain
- getters for `Chain.blocks`
- numeric first class data

### Changed
- `StakingBank` to be `ERC20` compatible
- make Chain states: `validatorRegistry`, `stakingBank`, `interval` to be public
- replace sparse merkle tree with sorted merkle tree
- sort leaves keys in merkle tree
- use coders from `@umb-network/toolbox` in tests
- changed how block is mine: use `blockPadding` instead of `interval`
