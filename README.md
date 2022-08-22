# MarketPlace

## About

The ExchangeV4 contract is a marketlplace contract that  allows you to buy/order/offer ERC721/ERC1155 

## Prerequisites

- Install [Node](https://nodejs.org/)
- Install [Hardhat](https://hardhat.org/getting-started#installation)

## Getting Started

1. Clone the repo locally
2. Install packages with `npm install`

## Run Tests

1. copy and paste the private key into hardhat.config.js
2. Run command `npx hardhat --network ganache test`

## Deployment

1. For the deployment of smart contracts, we need to choose a network, i.e., bscmainnet, etherum, rinkeby or other network.
2. Token Address should be pasted into deploy.js in the scripts folder.
3. Run command `npx hardhat run --network networkname scripts/deploy.js`
4. To verify contract Run Command `npx hardhat verify --network networkname deployedContractAddress arguments`

## For Example
1. npx hardhat run --network rinkeby scripts/deploy.js
2. npx hardhat verify --network rinkeby deployedAddress `(from step 1)` arguments from `deploy.js`
 



