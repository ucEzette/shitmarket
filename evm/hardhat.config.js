require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });
require("dotenv").config({ path: "../indexer/.env" });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    fuji: {
      url: process.env.AVALANCHE_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
      accounts: process.env.EVM_DEPLOYER_PRIVATE_KEY 
        ? [process.env.EVM_DEPLOYER_PRIVATE_KEY] 
        : (process.env.EVM_KEEPER_PRIVATE_KEY ? [process.env.EVM_KEEPER_PRIVATE_KEY] : [])
    }
  },
  etherscan: {
    apiKey: {
      fuji: "snowtrace"
    },
    customChains: [
      {
        network: "fuji",
        chainId: 43113,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan",
          browserURL: "https://testnet.snowtrace.io"
        }
      }
    ]
  }
};
