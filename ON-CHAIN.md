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

### Fallback

Fallback job is to make sure, that even when contract address will be updated you will be able to read data in
transparent way.
It is almost as a proxy but cheaper in a long run.

With proxy contract is forced to read `implementation` address all the time. With fallback, search for new address is
done ONLY when it is needed and only then, additional cost is added to the tx.

Redeployments of contracts are very rare, so it is more effective to simply update contract address when needed than
paying additional fee all the time.

If data is not present in destination contract, fallback will resolve current contract (1 additional storage read) and
will do a call to new contract for the data (second additional storage read).

Fallback is also more flexible solution:

- you can use direct calls for maximum gas efficiency + fallback in case of emergency  
  in most cases, redeploying contract with new constant address might be the most efficient option
- you can use resolve current address by your own to avoid fallback

How to resolve newest `UmbrellaFeeds` contract address:

```solidity
IRegistry.getAddress(bytes32("UmbrellaFeeds"))
```

## Gas calculations

- `OnchainDataCompareGasTest` contract (foundry tests) was used to compare costs.
- Avalanche blockchain was used to fork network
- Calculation done at: May 16, 2023.


Chainlink cost for calling `latestRoundData()` (proxy): 18753 gas. \
Chainlink cost for calling `latestRoundData()` directly on aggregator: 10508 gas but only proxy can call (there is
access control here).


Umbrella has multiple ways for pulling price. They can be chosen based on case.

- Fallback will add `15485` gas.
- Resolving current contract address (you have to do it inside your contract) will add `5792` gas.

| contract            | method                     | min gas cost | compare to Chainlink |
|---------------------|----------------------------|--------------|----------------------|
| UmbrellaFeeds       | getPrice                   | 6889         | 2.7x less            |
| UmbrellaFeeds       | getPriceTimestamp          | 7131         | 2.6x less            |        
| UmbrellaFeeds       | getPriceTimestampHeartbeat | 7313         | 2.6x less            |
| UmbrellaFeeds       | getPriceData               | 7479         | 2.5x less            |
| UmbrellaFeedsReader | latestRoundData            | 12466        | 1.5x less            |
| UmbrellaFeedsReader | getPriceData               | 12431        | 1.5x less            |

###