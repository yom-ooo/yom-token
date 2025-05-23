const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider("https://erpc-async.agung.peaq.network/");
const address = "0x3c1400E3Dc7cb3C3C17E655B09970CBaEcBD20fd"; // Replace with your address

async function checkMempool() {
  try {
    const txPool = await provider.send("txpool_content", []);
    const pendingTxs = txPool.pending[address.toLowerCase()];

    if (pendingTxs) {
      console.log("Pending Transactions for Account:", pendingTxs);
    } else {
      console.log("No pending transactions found for your address.");
    }
  } catch (error) {
    console.error("Error checking mempool:", error);
  }
}

checkMempool();