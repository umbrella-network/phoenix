# Switching to MAsterChain

## QA

### Staging

```shell
FORKING_ENV=eth|bsc hardhat node

# update Registry address in deployments/localhost/Registry.json to be the one from mainnet
# see config/ for current addresses 

STAGING=1 hardhat deploy --network localhost
```
