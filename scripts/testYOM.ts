import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  // Load deployment info
  const deploymentInfo = JSON.parse(fs.readFileSync("yom-deployment-localhost.json", "utf8"));
  const YOM_ADDRESS = deploymentInfo.yomToken;
  
  console.log("🪙 Testing YOM Token at:", YOM_ADDRESS);
  console.log("");

  // Get signers (test accounts)
  const [owner, user1, user2, user3] = await ethers.getSigners();
  
  // Connect to YOM token (use YOMSimple for localhost)
  const yom = await ethers.getContractAt("YOMSimple", YOM_ADDRESS);
  
  // 1. Check initial state
  console.log("📊 Initial State:");
  console.log("Total Supply:", ethers.utils.formatEther(await yom.totalSupply()), "YOM");
  console.log("Owner Balance:", ethers.utils.formatEther(await yom.balanceOf(owner.address)), "YOM");
  console.log("Buy Tax:", (await yom.buyTaxBps()).toString(), "bps");
  console.log("Sell Tax:", (await yom.sellTaxBps()).toString(), "bps");
  console.log("");

  // 2. Transfer tokens to users (no tax on normal transfers)
  console.log("💸 Transferring tokens to users...");
  await yom.transfer(user1.address, ethers.utils.parseEther("1000000")); // 1M to user1
  await yom.transfer(user2.address, ethers.utils.parseEther("1000000")); // 1M to user2
  console.log("✅ Transfers complete");
  
  console.log("\n💰 Balances after transfer:");
  console.log("Owner:", ethers.utils.formatEther(await yom.balanceOf(owner.address)), "YOM");
  console.log("User1:", ethers.utils.formatEther(await yom.balanceOf(user1.address)), "YOM");
  console.log("User2:", ethers.utils.formatEther(await yom.balanceOf(user2.address)), "YOM");
  console.log("");

  // 3. Create a mock AMM pair
  console.log("🏪 Setting up mock AMM pair...");
  const mockAMM = user3.address; // Use user3 as mock AMM
  await yom.setAMMPair(mockAMM, true);
  console.log("✅ AMM pair set:", mockAMM);
  
  // Transfer tokens to AMM
  await yom.transfer(mockAMM, ethers.utils.parseEther("10000000")); // 10M to AMM
  console.log("✅ Liquidity added to AMM");
  console.log("");

  // 4. Simulate a buy (AMM -> User) - should have 2% tax
  console.log("🛒 Simulating BUY from AMM (2% tax expected)...");
  const buyAmount = ethers.utils.parseEther("10000"); // 10k YOM
  const feeCollectorBefore = await yom.balanceOf(await yom.feeCollector());
  
  await yom.connect(await ethers.getSigner(mockAMM)).transfer(user1.address, buyAmount);
  
  const feeCollectorAfter = await yom.balanceOf(await yom.feeCollector());
  const buyTax = feeCollectorAfter.sub(feeCollectorBefore);
  
  console.log("Buy amount:", ethers.utils.formatEther(buyAmount), "YOM");
  console.log("Tax collected:", ethers.utils.formatEther(buyTax), "YOM");
  console.log("Tax rate:", buyTax.mul(10000).div(buyAmount).toString(), "bps");
  console.log("");

  // Wait for next block to avoid cooldown
  console.log("⏳ Mining new block to avoid MEV cooldown...");
  await ethers.provider.send("evm_mine", []);
  console.log("✅ New block mined");
  console.log("");

  // 5. Simulate a sell (User -> AMM) - should have 3% tax
  console.log("💰 Simulating SELL to AMM (3% tax expected)...");
  const sellAmount = ethers.utils.parseEther("5000"); // 5k YOM
  const feeCollectorBeforeSell = await yom.balanceOf(await yom.feeCollector());
  
  await yom.connect(user1).transfer(mockAMM, sellAmount);
  
  const feeCollectorAfterSell = await yom.balanceOf(await yom.feeCollector());
  const sellTax = feeCollectorAfterSell.sub(feeCollectorBeforeSell);
  
  console.log("Sell amount:", ethers.utils.formatEther(sellAmount), "YOM");
  console.log("Tax collected:", ethers.utils.formatEther(sellTax), "YOM");
  console.log("Tax rate:", sellTax.mul(10000).div(sellAmount).toString(), "bps");
  console.log("");

  // 6. Test burn function
  console.log("🔥 Testing burn function...");
  const burnAmount = ethers.utils.parseEther("100");
  const totalSupplyBefore = await yom.totalSupply();
  
  await yom.connect(user2).burn(burnAmount);
  
  const totalSupplyAfter = await yom.totalSupply();
  console.log("Burned:", ethers.utils.formatEther(burnAmount), "YOM");
  console.log("Total supply reduced by:", ethers.utils.formatEther(totalSupplyBefore.sub(totalSupplyAfter)), "YOM");
  console.log("");

  // 7. Test admin functions
  console.log("⚙️  Testing admin functions...");
  
  // Change tax rates
  await yom.setTaxRates(500, 700); // 5% buy, 7% sell
  console.log("✅ Tax rates updated to 5% buy, 7% sell");
  
  // Test exclusion
  await yom.setExclusion(user2.address, true);
  console.log("✅ User2 excluded from tax");
  
  // Final summary
  console.log("\n📊 Final Tax Summary:");
  const taxBreakdown = await yom.getTaxBreakdown();
  console.log("Total Buy Tax Collected:", ethers.utils.formatEther(taxBreakdown.buyTax), "YOM");
  console.log("Total Sell Tax Collected:", ethers.utils.formatEther(taxBreakdown.sellTax), "YOM");
  console.log("Total Tax Collected:", ethers.utils.formatEther(taxBreakdown.total), "YOM");
  
  console.log("\n💰 Final Balances:");
  console.log("Owner:", ethers.utils.formatEther(await yom.balanceOf(owner.address)), "YOM");
  console.log("User1:", ethers.utils.formatEther(await yom.balanceOf(user1.address)), "YOM");
  console.log("User2:", ethers.utils.formatEther(await yom.balanceOf(user2.address)), "YOM");
  console.log("Fee Collector:", ethers.utils.formatEther(await yom.balanceOf(await yom.feeCollector())), "YOM");
  console.log("AMM:", ethers.utils.formatEther(await yom.balanceOf(mockAMM)), "YOM");
  console.log("Total Supply:", ethers.utils.formatEther(await yom.totalSupply()), "YOM");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });