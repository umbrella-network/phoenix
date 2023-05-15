# Umbrella On-chain data

## How to use it

Prices are stored under a `key`. `key` is constant, and it is hash of feed name eg `hash("UMB-USD")`.

### Direct access

It is recommended option, most gas effective.

There is main contract called `UmbrellaFeeds` where all prices are submitted.
Use `getPriceData(key)` method to get price data about specified `key`. Price data contains:

```solidity
struct PriceData {
    uint8 data; // not in use, reserved for future
    uint24 heartbeat; // if price is flat, how often it will be updated
    uint32 timestamp; // last update
    uint128 price; // 8 decimals
}
```

### Via reader

There is option to create dedicated contract reader that also provides chainlink like interface:

- go to `UmbrellaFeedsReaderFactory` and use `deployed(key)` method to check, if there is already contract for your key.
- if not, use `UmbrellaFeedsReaderFactory.deploy(key)` method to create contract for your key. It will create
  new `UmbrellaFeedsReader` contract that is dedicated for provided `key`.
    - use `deployed(key)` method to read address of deployed contract.
    - in case contract code is not verified automatically, you can use (UmbrellaFeedsReader standard
      JSON)[./flattened/UmbrellaFeedsReader.stdandard.json] to verify its code
- `UmbrellaFeedsReader` provides few methods that you can use depends on your case:
    - `latestRoundData()` - it follows chainlink interface to easier migration process from Chainlink to Umbrella.
      IMPORTANT: only `answer` and `updatedAt` are in use.
    - `getPriceData()` - it returns `PriceData`

## Deployments

On blockchain where we do have L2 consensus:

```shell
npx hardhat deploy --network avalanche_staging
npx hardhat registerStakingBankStatic --network avalanche_staging
# just in case chain needs to be redeployed
npx hardhat deploy --network avalanche_staging

npx hardhat registerChain --network avalanche_staging
npx hardhat registerUmbrellaFeeds --network avalanche_staging
npx hardhat registerReaderFactory --network avalanche_staging
```

On blockchain with only on-chain data:

```
npx hardhat deploy --network linea_staging

npx hardhat registerStakingBankStatic --network linea_staging
npx hardhat registerUmbrellaFeeds --network linea_staging
npx hardhat registerReaderFactory --network linea_staging
```

## Code verification on Linea

At the moment of developing hardhat verification not supporting linea, hardhat flattener was not working all the time.

Here are steps that seems to be working always:

```
# we need deploy to other network and verify code there

# UmbrellaFeedsReader
npx hardhat linea-verify --network avalanche_staging --address 0xAE9F0717E854285Ff8446fD9a75182e8ECf1d80D --name UmbrellaFeedsReader
npx hardhat linea-verify --network avalanche_staging --name UmbrellaFeeds  
npx hardhat linea-verify --network avalanche_staging --name UmbrellaFeedsReaderFactory  
```

As result of `linea-verify`, stardard JSON file is created. Use it to verify contract on linea.
