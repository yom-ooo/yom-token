import hre from "hardhat";
const { ethers } = hre;

async function main() {
  const FACTORY_ADDRESS = "0x157fe708955dF00062fF332e8Bf2252Dfe184075";
  const salt = "0x4c3eb991c812476f8e2cfd1a2b4d462bef1083ae1c280676ba48b95356351f01";

  const [deployer] = await ethers.getSigners();
  const initialOwner = deployer.address;         // YOM arg #1
  const lzEndpoint   = "0xYourPeaqEndpoint";     // YOM arg #2  ❗ fill in
  const delegate     = deployer.address;         // YOM arg #3 (owner)

  // ── build byte-code with all 3 constructor params
  const YOM = await ethers.getContractFactory("YOM");
  const deployTx: any = await YOM.getDeployTransaction(
      initialOwner,
      lzEndpoint,
      delegate
  );
  const bytecode = deployTx.data as string;

  console.log("Full creation bytecode length:", bytecode?.length);

  // 4. Connect to the deployed Factory contract.
  const factory = await ethers.getContractAt("Factory", FACTORY_ADDRESS);

  // 5. Compute the expected deployed contract address using the factory’s computeAddress function.
  const computedAddress = await factory.computeAddress(salt, bytecode);
  console.log("Computed expected contract address:", computedAddress);

  // 6. (Optional) Attempt to estimate gas for the deployment
  try {
    const gasEstimate = await (factory as any).estimateGas.deploy(salt, bytecode);
    console.log("Gas estimate for deployment:", gasEstimate.toString());
  } catch (err) {
    console.log("Gas estimation failed:", err);
  }

  // 7. Set a manual gas limit for deployment (adjust as needed)
  const gasLimit = 5_000_000;
  console.log("Using gas limit:", gasLimit);

  // 8. Deploy the YOM contract via the Factory using CREATE2
  console.log("Sending deploy transaction via factory...");
  const tx = await factory.deploy(salt, bytecode, { gasLimit });
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
    deployedAddress = await factory.computeAddress(salt, bytecode);
    console.log("No event found, computed deployed address:", deployedAddress);
  }
  console.log("Final deployed YOM contract address:", deployedAddress);
}

main().catch((err) => {
  console.error("Deployment script failed:", err);
  process.exitCode = 1;
});
