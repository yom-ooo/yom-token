const cancelTx = await wallet.sendTransaction({
    to: wallet.address,               // Send to yourself
    value: 0,                         // No value
    nonce: 6,                         // SAME nonce as the stuck transaction
    gasLimit: 21000,
    maxPriorityFeePerGas: ethers.parseUnits("5", "gwei"),
    maxFeePerGas: ethers.parseUnits("20", "gwei")
  });
  
  console.log("Cancel transaction sent:", cancelTx.hash);
  await cancelTx.wait();
  console.log("Transaction canceled.");