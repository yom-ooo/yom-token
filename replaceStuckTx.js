const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider("https://erpc-async.agung.peaq.network/");
const privateKey = "f8a5787c79b3ffdfa3d8d95f210da377d6226de317131f9ed2af1fc22869844f"; // Replace with your deployer's private key
const wallet = new ethers.Wallet(privateKey, provider);

async function replaceStuckTx() {
  try {
    const cancelTx = await wallet.sendTransaction({
      to: wallet.address,               // Send to yourself
      value: 0,                         // No value
      nonce: 7,                         // SAME nonce as the stuck transaction
      gasLimit: 21000,
      maxPriorityFeePerGas: ethers.parseUnits("5", "gwei"),
      maxFeePerGas: ethers.parseUnits("20", "gwei")
    });
    
    console.log("Cancel transaction sent:", cancelTx.hash);
    await cancelTx.wait();
    console.log("Transaction canceled.");
  } catch (error) {
    console.error("Error:", error);
  }
}

replaceStuckTx();