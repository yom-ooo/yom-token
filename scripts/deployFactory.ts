import { ethers, network } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("Network:", network.name);
  console.log("Network config:", network.config);
  
  try {
    console.log("Getting provider...");
    const provider = ethers.provider;
    console.log("Provider URL:", provider.connection?.url || "No URL");
    
    console.log("Getting signers...");
    const signers = await ethers.getSigners();
    console.log("Number of signers:", signers.length);
    
    if (signers.length === 0) {
      // Try alternative method
      console.log("No signers found, trying with private key from env...");
      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        throw new Error("No PRIVATE_KEY in .env file!");
      }
      
      const wallet = new ethers.Wallet(privateKey, provider);
      console.log(`Using wallet address: ${wallet.address}`);
      console.log(`Wallet balance: ${ethers.utils.formatEther(await wallet.getBalance())} ETH`);
      
      const Factory = await ethers.getContractFactory("Factory", wallet);
      const factory = await Factory.deploy();
      await factory.deployed();
      
      console.log("Factory deployed at:", factory.address);
      
      const config = {
        factory: factory.address,
        network: network.name,
        deployer: wallet.address,
        timestamp: new Date().toISOString()
      };

      fs.writeFileSync(
        `factory-${network.name}.json`, 
        JSON.stringify(config, null, 2)
      );
      
      console.log(`\n✅ Factory address saved to factory-${network.name}.json`);
      return;
    }
    
    const deployer = signers[0];
    console.log(`Deploying Factory with account: ${deployer.address}`);
    console.log(`Account balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);

    const Factory = await ethers.getContractFactory("Factory");
    const factory = await Factory.deploy();
    await factory.deployed();

    console.log("Factory deployed at:", factory.address);

    const config = {
      factory: factory.address,
      network: network.name,
      deployer: deployer.address,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
      `factory-${network.name}.json`, 
      JSON.stringify(config, null, 2)
    );
    
    console.log(`\n✅ Factory address saved to factory-${network.name}.json`);
    
  } catch (error) {
    console.error("Detailed error:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error in deployment:", error);
    process.exit(1);
  });