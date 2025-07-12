import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 10_000 },
      viaIR: true
    }
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      // Geen accounts opgeven - Hardhat zal automatisch de accounts van de node gebruiken
    },
    hardhat: {
      chainId: 31337,
      mining: {
        auto: true,
        interval: 0
      }
    },
    peaqTestnet: {
      url: process.env.PEAQ_RPC_URL_TEST || "https://erpc-async.agung.peaq.network/",
      chainId: Number(process.env.PEAQ_CHAIN_ID_TEST) || 9990,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    peaqMainnet: {
      url: process.env.PEAQ_RPC_URL || "https://erpc-async.agung.peaq.network/",
      chainId: Number(process.env.PEAQ_CHAIN_ID) || 9990,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};

export default config;