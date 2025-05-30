import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 10_000 },
      viaIR: true                    //  ← enable the IR (Yul) backend
    }
  },
  networks: {
    peaqTestnet: {
      url: process.env.PEAQ_RPC_URL_TEST,
      chainId: Number(process.env.PEAQ_CHAIN_ID_TEST),
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    peaqMainnet: {
      url: process.env.PEAQ_RPC_URL,
      chainId: Number(process.env.PEAQ_CHAIN_ID),
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};

export default config;
