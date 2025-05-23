const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider("https://erpc-async.agung.peaq.network/");
const privateKey = "f8a5787c79b3ffdfa3d8d95f210da377d6226de317131f9ed2af1fc22869844f"; // Replace with your private key
const wallet = new ethers.Wallet(privateKey, provider);

async function replaceStuckTransactions() {
  try {
    const confirmedNonce = await provider.getTransactionCount(wallet.address, "latest");
    const pendingNonce = await provider.getTransactionCount(wallet.address, "pending");

    console.log(`Confirmed Nonce: ${confirmedNonce}`);
    console.log(`Pending Nonce: ${pendingNonce}`);

    for (let nonce = confirmedNonce; nonce < pendingNonce; nonce++) {
      console.log(`Replacing stuck transaction with nonce: ${nonce}`);

      const tx = await wallet.sendTransaction({
        to: wallet.address,               // Send to yourself (acts as a cancel)
        value: 0,                         // No value
        nonce: nonce,                     // Target stuck nonce
        gasLimit: 21000,
        maxPriorityFeePerGas: ethers.parseUnits("50", "gwei"),  // High priority fee
        maxFeePerGas: ethers.parseUnits("100", "gwei")          // High max fee
      });

      console.log(`Replacement transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log(`Transaction with nonce ${nonce} confirmed.`);
    }

    console.log("All stuck transactions have been replaced.");
  } catch (error) {
    console.error("Error replacing stuck transactions:", error);
  }
}

replaceStuckTransactions();
