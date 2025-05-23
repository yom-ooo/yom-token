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
  // Replace with your deployed Factory contract address.
  const FACTORY_ADDRESS = "0x157fe708955dF00062fF332e8Bf2252Dfe184075";
  
  // Set your desired vanity prefix.
  // For example, if you want the address to start with "0x666", then:
  const desiredPrefix = "0x333";
  
  // Get the deployer signer and define the desired owner.
  const [deployer] = await ethers.getSigners();
  const desiredOwner = deployer.address;
  console.log("Using desired owner:", desiredOwner);
  
  // Get the contract factory for YOM (the version with the constructor accepting the owner).
  const YOMFactory = await ethers.getContractFactory("YOM");
  
  // Get the full deployment bytecode (including constructor arguments) by calling getDeployTransaction.
  // In ethers v6, this returns a Promise<ContractDeployTransaction>; we cast it to any so we can access the data field.
  const deployTx = await YOMFactory.getDeployTransaction(desiredOwner) as any;
  const bytecode: string = deployTx.data;
  console.log("Full creation bytecode length:", bytecode.length);
  
  let foundSalt: string | null = null;
  const maxAttempts = 1_000_000; // Adjust as needed
  
  // Brute-force possible salts.
  for (let i = 0; i < maxAttempts; i++) {
    // Generate a salt by hashing the string representation of i.
    const salt = ethers.keccak256(ethers.toUtf8Bytes(i.toString()));
    
    // Compute the expected address using the factory address, salt, and full creation bytecode.
    const computedAddress = computeCreate2Address(FACTORY_ADDRESS, salt, bytecode);
    
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
