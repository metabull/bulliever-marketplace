require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-ganache");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "rinkeby",
  networks: {
    hardhat: {},
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/e0737333518f412892d21b1762e8fe47",
      accounts: [""],
      chainId: 4,
      live: true,
      saveDeployments: true,
      // tags: ["staging"],
      // gasPrice: 5000000000,
      // gasMultiplier: 2,
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/7cd4731a3be74a6ab7c32fe799ab3177`,
      accounts: [""],
      gasPrice: 120 * 1000000000,
      // chainId: 1,
    },
    polygontestnet: {
      url: `https://polygon-mumbai.infura.io/v3/e0737333518f412892d21b1762e8fe47`,
      accounts: [""],
      //gasPrice: 120 * 1000000000,
      // chainId: 1,
    },
    polygon: {
      url: `https://polygon-mainnet.infura.io/v3/e0737333518f412892d21b1762e8fe47`,
      accounts: [""],
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
};
