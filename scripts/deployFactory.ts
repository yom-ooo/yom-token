import hre from "hardhat";
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying Factory with account: ${deployer.address}`);

  const Factory = await ethers.getContractFactory("Factory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();

  console.log("Factory deployed at:", factory.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
