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
  const bytecodeHash = ethers.keccak256(bytecode);
  
  // Pack the inputs per the CREATE2 spec: 0xff, factoryAddress, salt, bytecodeHash.
  const packed = ethers.solidityPackedKeccak256(
    ["bytes1", "address", "bytes32", "bytes32"],
    ["0xff", factoryAddress, salt, bytecodeHash]
  );
  
  // The deployed contract address is the last 20 bytes of the hash.
  return "0x" + packed.slice(-40);
}

async function main() {
  const FACTORY = "0x157fe708955dF00062fF332e8Bf2252Dfe184075";
  const desiredPrefix = "0x666";

  const [deployer] = await ethers.getSigners();
  const initialOwner = deployer.address;
  const lzEndpoint   = "0xYourPeaqEndpoint";   // same as deploy.ts
  const delegate     = deployer.address;

  const YOM = await ethers.getContractFactory("YOM");
  const tx: any = await YOM.getDeployTransaction(
       initialOwner,
       lzEndpoint,
       delegate
  );
  const bytecode = tx.data as string;

  console.log("Full creation bytecode length:", bytecode.length);
  
  let foundSalt: string | null = null;
  const maxAttempts = 1_000_000; // Adjust as needed
  
  // Brute-force possible salts.
  for (let i = 0; i < maxAttempts; i++) {
    // Generate a salt by hashing the string representation of i.
    const salt = ethers.keccak256(ethers.toUtf8Bytes(i.toString()));
    
    // Compute the expected address using the factory address, salt, and full creation bytecode.
    const computedAddress = computeCreate2Address(FACTORY, salt, bytecode);
    
    // Check if the computed address has the desired prefix.
    if (computedAddress.toLowerCase().startsWith(desiredPrefix)) {
      foundSalt = salt;
      console.log(`Found matching vanity address: ${computedAddress}`);
      console.log(`Salt: ${salt}`);
      break;
    }
    
    // Log progress every 10,000 attempts.
    if (i % 10000 === 0) {
      console.log(`Attempt ${i}... computedAddress=${computedAddress}`);
    }
  }
  
  if (!foundSalt) {
    console.log("No matching salt found in range.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
