#!/bin/sh

# bash --version

## declare an array variable
declare -a arr=(
"arbitrum_production"
"avalanche_production"
"eth_production"
"bnb_production"
"base_production"
"polygon_production"
"linea_production"
)


## now loop through the above array
## adjust script to your needs, as it must be run few times
for i in "${arr[@]}"
do
  if [[ $1 == "1" ]]
  then
      echo "
      deploy $i
      ---------------
      "
      hardhat deploy --network $i
  fi

  if [[ $1 == "2" ]]
  then
      echo "
      registerStakingBankStatic $i
      ---------------
      "
      npx hardhat registerStakingBankStatic --network $i --update
  fi

  if [[ $1 == "3" ]]
  then
      echo "
      rm $i
      ---------------
      "
      rm deployments/$i/ForeignChain.json
      rm deployments/$i/Chain.json
      rm deployments/$i/UmbrellaFeeds.json
  fi

  if [[ $1 == "4" ]]
  then
      echo "
      registerChain $i
      ---------------
      "
      npx hardhat registerChain --network $i
  fi

  if [[ $1 == "5" ]]
  then
    declare destroy="any"

    if [[ $i == "base_production" ]]
    then destroy="ETH-USD"
    fi

    if [[ $i == "polygon_production" ]]
    then destroy="PolygonGas-TWAP10-wei"
    fi

    if [[ $i == "linea_production" ]]
    then destroy="ETH-USD"
    fi

    echo "
    registerUmbrellaFeeds $i destroy=$destroy
    ---------------
    "
    npx hardhat registerUmbrellaFeeds --network $i --update --destroy $destroy
  fi
done

