require("dotenv").config();

require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-ganache");
require("hardhat-gas-reporter");

const { MNEMONIC } = process.env;

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    mainnet: {
      url: `https://mainnet.infura.io/v3/7cd4731a3be74a6ab7c32fe799ab3177`,
      accounts: [MNEMONIC],
      gasPrice: 120 * 1000000000,
      // chainId: 1,
    },
    polygontestnet: {
      url: `https://polygon-mumbai.infura.io/v3/e0737333518f412892d21b1762e8fe47`,
      accounts: [MNEMONIC],
      //gasPrice: 120 * 1000000000,
      // chainId: 1,
    },
    polygon: {
      url: `https://polygon-mainnet.infura.io/v3/e0737333518f412892d21b1762e8fe47`,
      accounts: [MNEMONIC],
      gasPrice: 120 * 1000000000,
      // chainId: 1,
    },
  },
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
    // tests: "./test",s
    cache: "./cache",
    artifacts: "./artifacts",
  },
  etherscan: {
    //apiKey: "BPN7F7YIVAEVCHN3WI1SFZ73EKAR8FQ49Z",
    apiKey: "6F2QV99DME1GBEHFT668GJ64M948SMT75N",
  },
  mocha: {
    timeout: 20000,
  },
  gasReporter: {
    enabled: true,
    // outputFile: "gas-report-with-out-history-with-10.txt",
    currency: "USD",
    //coinmarketcap: process.env.coinmarketcap,
    gasPrice: 20,
  },
};
