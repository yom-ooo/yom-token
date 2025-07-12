import { ethers } from "hardhat";

/**
 * Computes the CREATE2 address using the factory address, salt, and full creation bytecode.
 * @param factoryAddress - The address of the factory contract.
 * @param salt - A 32-byte salt value (as a hex string).
 * @param bytecode - The full creation bytecode (including constructor arguments).
 * @returns The computed contract address.
 */
function computeCreate2Address(factoryAddress: string, salt: string, bytecode: string): string {
  // Compute the hash of the creation bytecode.
  const bytecodeHash = ethers.utils.keccak256(bytecode);
  
  // Pack the inputs per the CREATE2 spec: 0xff, factoryAddress, salt, bytecodeHash.
  const packed = ethers.utils.solidityKeccak256(
    ["bytes1", "address", "bytes32", "bytes32"],
    ["0xff", factoryAddress, salt, bytecodeHash]
  );
  
  // The deployed contract address is the last 20 bytes of the hash.
  return "0x" + packed.slice(-40);
}

async function main() {
  // Use YOUR deployed factory address!
  const FACTORY = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const desiredPrefix = "0x666";

  const [deployer] = await ethers.getSigners();
  const initialOwner = deployer.address;
  
  // Voor localhost gebruiken we een dummy endpoint address
  // Dit moet EXACT hetzelfde zijn als wat je in deploy.ts gaat gebruiken!
  const lzEndpoint = "0x0000000000000000000000000000000000000001"; // Dummy address
  const delegate = deployer.address;

  console.log("Factory Address:", FACTORY);
  console.log("Initial Owner:", initialOwner);
  console.log("LZ Endpoint:", lzEndpoint);
  console.log("Delegate:", delegate);
  console.log("Searching for prefix:", desiredPrefix);
  console.log("");

  const YOM = await ethers.getContractFactory("YOM");
  const tx = YOM.getDeployTransaction(
       initialOwner,
       lzEndpoint,
       delegate
  );
  const bytecode = tx.data as string;

  console.log("Full creation bytecode length:", bytecode.length);
  console.log("Starting search...\n");
  
  let foundSalt: string | null = null;
  const maxAttempts = 1_000_000; // Adjust as needed
  
  // Brute-force possible salts.
  for (let i = 0; i < maxAttempts; i++) {
    // Generate a salt by hashing the string representation of i.
    const salt = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(i.toString()));
    
    // Compute the expected address using the factory address, salt, and full creation bytecode.
    const computedAddress = computeCreate2Address(FACTORY, salt, bytecode);
    
    // Check if the computed address has the desired prefix.
    if (computedAddress.toLowerCase().startsWith(desiredPrefix)) {
      foundSalt = salt;
      console.log(`\n✅ Found matching vanity address!`);
      console.log(`Address: ${computedAddress}`);
      console.log(`Salt: ${salt}`);
      console.log(`\nTo deploy with this address, run:`);
      console.log(`SALT=${salt} npx hardhat run scripts/deploy.ts --network localhost`);
      break;
    }
    
    // Log progress every 10,000 attempts.
    if (i % 10000 === 0 && i > 0) {
      console.log(`Attempt ${i}... last computed: ${computedAddress}`);
    }
  }
  
  if (!foundSalt) {
    console.log("\n❌ No matching salt found in range. Try increasing maxAttempts or using a shorter prefix.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});