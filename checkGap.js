const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider("https://erpc-async.agung.peaq.network/");
const deployerAddress = "0x3c1400E3Dc7cb3C3C17E655B09970CBaEcBD20fd";

async function checkNonces() {
  const confirmedNonce = await provider.getTransactionCount(deployerAddress, "latest");
  const pendingNonce = await provider.getTransactionCount(deployerAddress, "pending");

  console.log("Confirmed Nonce:", confirmedNonce);
  console.log("Pending Nonce:", pendingNonce);
}

checkNonces();
