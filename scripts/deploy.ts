import hre from "hardhat";
const { ethers } = hre;

async function main() {
  // 1. Configuration: Set the Factory address and the found salt.
  const FACTORY_ADDRESS = "0x157fe708955dF00062fF332e8Bf2252Dfe184075"; // your deployed factory
  const foundSalt = "0x4c3eb991c812476f8e2cfd1a2b4d462bef1083ae1c280676ba48b95356351f01"; // your found salt

  // 2. Get the deployer's signer (the desired owner)
  const [deployer] = await ethers.getSigners();
  const desiredOwner = deployer.address;
  console.log("Desired owner (will be initialOwner):", desiredOwner);

  // 3. Get the contract factory for YOM and obtain the full deployment bytecode.
  const YOMFactory = await ethers.getContractFactory("YOM");
  // getDeployTransaction accepts the constructor argument—in this case, desiredOwner.
  // Cast to any so we can access the data property
  const deployTx = await YOMFactory.getDeployTransaction(desiredOwner) as any;
  const bytecode: string = deployTx.data;
  console.log("Full creation bytecode length:", bytecode?.length);

  // 4. Connect to the deployed Factory contract.
  const factory = await ethers.getContractAt("Factory", FACTORY_ADDRESS);

  // 5. Compute the expected deployed contract address using the factory’s computeAddress function.
  const computedAddress = await factory.computeAddress(foundSalt, bytecode);
  console.log("Computed expected contract address:", computedAddress);

  // 6. (Optional) Attempt to estimate gas for the deployment
  try {
    const gasEstimate = await (factory as any).estimateGas.deploy(foundSalt, bytecode);
    console.log("Gas estimate for deployment:", gasEstimate.toString());
  } catch (err) {
    console.log("Gas estimation failed:", err);
  }

  // 7. Set a manual gas limit for deployment (adjust as needed)
  const gasLimit = 5_000_000;
  console.log("Using gas limit:", gasLimit);

  // 8. Deploy the YOM contract via the Factory using CREATE2
  console.log("Sending deploy transaction via factory...");
  const tx = await factory.deploy(foundSalt, bytecode, { gasLimit });
  console.log("Transaction hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("Transaction mined. Full receipt:", receipt);

  // 9. Extract the deployed contract address from event logs if available.
  let deployedAddress;
  if (receipt.events && receipt.events.length > 0) {
    for (const event of receipt.events) {
      console.log("Event log:", event);
      if (event.args && event.args.newContract) {
        deployedAddress = event.args.newContract;
        console.log("Found deployed address in event:", deployedAddress);
        break;
      }
    }
  }
  // 10. Fallback: Compute the deployed address deterministically.
  if (!deployedAddress) {
    deployedAddress = await factory.computeAddress(foundSalt, bytecode);
    console.log("No event found, computed deployed address:", deployedAddress);
  }
  console.log("Final deployed YOM contract address:", deployedAddress);
}

main().catch((err) => {
  console.error("Deployment script failed:", err);
  process.exitCode = 1;
});
