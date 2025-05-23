const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider("https://erpc-async.agung.peaq.network/");

async function checkTransaction() {
  const receipt = await provider.getTransactionReceipt("0x0f1072bfe48ac344bbc81631afa0a0b9f19932e913b2d4d6a180664d05c607ed");
  console.log(receipt);
}

checkTransaction();
