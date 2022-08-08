#!/bin/bash

while getopts :n: flag
do
    case "${flag}" in
        n) network=${OPTARG};;
    esac
done

if [ -z "$network" ]
  then
    echo "usage:
    ./add-deploy-network.sh -n <name>
    "
  exit 0;
fi

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

DEPLOY_DIR="${SCRIPT_DIR}/../deploy/${network}"

echo "adding deploy files to: ${SCRIPT_DIR}/../deploy/${network}"

rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

ln -s ../ethereum/Chain.deploy.ts
ln -s ../ethereum/Registry.deploy.ts
ln -s ../ethereum/StakingBank.deploy.ts
