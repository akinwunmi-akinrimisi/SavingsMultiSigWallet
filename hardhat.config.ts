import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config"

const { SEPOLIA_RPC_URL, ACCOUNT_PRIVATE_KEY, ETHERSCAN_API_KEY, ALCHEMY_API_KEY_URL } = process.env;

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    hardhat: {
      forking: {
        url: ALCHEMY_API_KEY_URL!,
      }
    },
    sepolia: {
      url: SEPOLIA_RPC_URL || "",
      accounts:
          ACCOUNT_PRIVATE_KEY !== undefined ? [ACCOUNT_PRIVATE_KEY] : []
    },
    // for testnet
    "lisk-sepolia": {
      url: process.env.LISK_RPC_URL!,
      accounts: [process.env.ACCOUNT_PRIVATE_KEY!],
      gasPrice: 1000000000,
    },
  },
  etherscan: {
    // Use "123" as a placeholder, because Blockscout doesn't need a real API key, and Hardhat will complain if this property isn't set.
    apiKey: {
      "lisk-sepolia": "123",
    },
    customChains: [
      {
        network: "lisk-sepolia",
        chainId: 4202,
        urls: {
          apiURL: "https://sepolia-blockscout.lisk.com/api",
          browserURL: "https://sepolia-blockscout.lisk.com/",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  }
};



export default config;