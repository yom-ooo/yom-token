import { ethers, network } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("🔍 Debug Deployment on", network.name);

  // Read factory config
  const factoryConfig = JSON.parse(fs.readFileSync(`factory-${network.name}.json`, 'utf8'));
  const FACTORY_ADDRESS = factoryConfig.factory;
  
  const [deployer] = await ethers.getSigners();
  console.log("\n📊 Account Info:");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");
  
  // Check factory
  const factory = await ethers.getContractAt("Factory", FACTORY_ADDRESS);
  console.log("\n🏭 Factory Info:");
  console.log("Factory address:", factory.address);
  
  // Check if factory has code
  const factoryCode = await ethers.provider.getCode(factory.address);
  console.log("Factory has code:", factoryCode !== "0x");
  
  // Test parameters
  const salt = "0x2c8c657a2d1712990b1927e436bbedb9a60f4119461172a2c3c606ff72a52352";
  const initialOwner = deployer.address;
  const lzEndpoint = "0x0000000000000000000000000000000000000001";
  const delegate = deployer.address;
  
  console.log("\n📋 Deploy Parameters:");
  console.log("Salt:", salt);
  console.log("Initial Owner:", initialOwner);
  console.log("LZ Endpoint:", lzEndpoint);
  console.log("Delegate:", delegate);
  
  // Build YOM bytecode
  const YOM = await ethers.getContractFactory("YOM");
  const deployTx = YOM.getDeployTransaction(initialOwner, lzEndpoint, delegate);
  const bytecode = deployTx.data as string;
  
  console.log("\n📦 Bytecode Info:");
  console.log("Bytecode length:", bytecode.length);
  console.log("First 10 bytes:", bytecode.substring(0, 10));
  
  // Compute expected address
  const computedAddress = await factory.computeAddress(salt, bytecode);
  console.log("\n🎯 Expected Address:", computedAddress);
  
  // Check if already deployed
  const existingCode = await ethers.provider.getCode(computedAddress);
  if (existingCode !== "0x") {
    console.log("\n⚠️  WARNING: Contract already deployed at this address!");
    console.log("Code length:", existingCode.length);
    return;
  }
  
  // Try smaller gas limit first
  console.log("\n🧪 Testing with smaller bytecode...");
  
  // Deploy a simple test contract first
  const testBytecode = "0x608060405234801561001057600080fd5b50603f8061001f6000396000f3fe6080604052600080fdfea2646970667358221220c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a47064736f6c63430008110033";
  const testSalt = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
  
  try {
    console.log("Deploying test contract...");
    const testTx = await factory.deploy(testSalt, testBytecode, { gasLimit: 500000 });
    await testTx.wait();
    console.log("✅ Test deployment successful!");
  } catch (error: any) {
    console.log("❌ Test deployment failed:", error.reason || error.message);
  }
  
  // Now try YOM with higher gas limit
  console.log("\n💰 Attempting YOM deployment with 10M gas limit...");
  try {
    const tx = await factory.deploy(salt, bytecode, { 
      gasLimit: 10_000_000,
      gasPrice: ethers.utils.parseUnits("20", "gwei")
    });
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Deployment successful!");
    console.log("Gas used:", receipt.gasUsed.toString());
  } catch (error: any) {
    console.log("\n❌ Deployment failed!");
    console.log("Error:", error.reason || error.message);
    
    // Try to get more info
    if (error.error && error.error.data) {
      console.log("Error data:", error.error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });