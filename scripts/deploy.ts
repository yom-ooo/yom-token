import { ethers, network } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log(`🚀 Deploying YOM Token on ${network.name}...\n`);

  // Check if factory exists
  const factoryConfigFile = `factory-${network.name}.json`;
  if (!fs.existsSync(factoryConfigFile)) {
    console.error(`❌ Factory not deployed yet! Run 'npx hardhat run scripts/deployFactory.ts --network ${network.name}' first`);
    process.exit(1);
  }

  const factoryConfig = JSON.parse(fs.readFileSync(factoryConfigFile, 'utf8'));
  const FACTORY_ADDRESS = factoryConfig.factory;
  console.log("📍 Using Factory at:", FACTORY_ADDRESS);

  // Generate salt based on network and timestamp OR use provided salt
  let salt: string;
  if (process.env.SALT) {
    salt = process.env.SALT;
    console.log("🔑 Using provided salt:", salt);
  } else {
    const saltString = `YOM-${network.name}-${Date.now()}`;
    salt = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(saltString));
    console.log("🔑 Generated salt:", salt);
  }

  const [deployer] = await ethers.getSigners();
  const initialOwner = deployer.address;
  const delegate = deployer.address;
  
  // Network-specific endpoint configuration
  let lzEndpoint: string;
  
  if (network.name === "localhost" || network.name === "hardhat") {
    // For local testing, use the SAME dummy endpoint as in findSalt.ts!
    lzEndpoint = "0x0000000000000000000000000000000000000001";
    console.log("📍 Using dummy endpoint for localhost:", lzEndpoint);
    
    // Optionally, deploy a real mock endpoint later if needed for testing
    // But for deployment, we need to use the same address as in findSalt!
    
  } else if (network.name === "peaqTestnet") {
    lzEndpoint = "0x6EDCE65403992e310A62460808c4b910D972f10f"; // LayerZero V2 Testnet endpoint
  } else if (network.name === "peaqMainnet") {
    lzEndpoint = "0x1a44076050125825900e736c501f859c50fE728c"; // LayerZero V2 Mainnet endpoint  
  } else {
    throw new Error(`No endpoint configured for network: ${network.name}`);
  }

  console.log("\n📋 Deployment Parameters:");
  console.log("  Initial Owner:", initialOwner);
  console.log("  LZ Endpoint:", lzEndpoint);
  console.log("  Delegate:", delegate);

  // Build bytecode with constructor params
  let contractName = "YOM";
  
  // Use simplified version for localhost to avoid size issues
  if (network.name === "localhost" || network.name === "hardhat") {
    contractName = "YOMSimple";
    console.log("📌 Using YOMSimple for local testing (without LayerZero)");
  }
  
  const YOMContract = await ethers.getContractFactory(contractName);
  const deployTx = YOMContract.getDeployTransaction(
    initialOwner,
    lzEndpoint,
    delegate
  );
  const bytecode = deployTx.data as string;

  console.log("\nFull creation bytecode length:", bytecode.length);

  // Connect to the deployed Factory contract
  const factory = await ethers.getContractAt("Factory", FACTORY_ADDRESS);

  // Compute the expected deployed contract address
  const computedAddress = await factory.computeAddress(salt, bytecode);
  console.log("Computed expected contract address:", computedAddress);

  // Estimate gas for deployment
  try {
    const gasEstimate = await factory.estimateGas.deploy(salt, bytecode);
    console.log("Gas estimate for deployment:", gasEstimate.toString());
  } catch (err) {
    console.log("Gas estimation failed, using default gas limit");
  }

  // Set a manual gas limit for deployment
  const gasLimit = 5_000_000;
  console.log("Using gas limit:", gasLimit);

  // Deploy the YOM contract via the Factory using CREATE2
  console.log("\n🚀 Sending deploy transaction via factory...");
  const tx = await factory.deploy(salt, bytecode, { gasLimit });
  console.log("Transaction hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("Transaction mined!");

  // Extract the deployed contract address from event logs
  let deployedAddress = computedAddress;
  if (receipt.events && receipt.events.length > 0) {
    for (const event of receipt.events) {
      if (event.args && event.args.newContract) {
        deployedAddress = event.args.newContract;
        console.log("Found deployed address in event:", deployedAddress);
        break;
      }
    }
  }

  console.log("\n✅ YOM Token deployed successfully!");
  console.log("📍 YOM Token address:", deployedAddress);
  
  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    yomToken: deployedAddress,
    factory: FACTORY_ADDRESS,
    lzEndpoint: lzEndpoint,
    deployer: deployer.address,
    salt: salt,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    `yom-deployment-${network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log(`\n📝 Deployment info saved to yom-deployment-${network.name}.json`);

  // Verify the deployment
  const yom = await ethers.getContractAt(contractName, deployedAddress);
  console.log("\n🔍 Verifying deployment:");
  console.log("  Name:", await yom.name());
  console.log("  Symbol:", await yom.symbol());
  console.log("  Total Supply:", ethers.utils.formatEther(await yom.totalSupply()));
  console.log("  Owner Balance:", ethers.utils.formatEther(await yom.balanceOf(deployer.address)));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment error:", error);
    process.exit(1);
  });