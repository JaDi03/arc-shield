import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying ArcShieldFactory to Arc Testnet...");

  const [deployer] = await ethers.getSigners();
  console.log(`🔑 Deploying with account: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  // USDC uses 18 decimals for gas paying on Arc Network natively
  console.log(`💰 Account balance: ${ethers.formatEther(balance)} USDC`);

  const ArcShieldFactory = await ethers.getContractFactory("ArcShieldFactory");
  const factory = await ArcShieldFactory.deploy();

  console.log("⏳ Waiting for deployment transaction to be mined...");
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log("\n✅ ArcShieldFactory deployed successfully!");
  console.log(`📌 Factory Address: ${factoryAddress}`);
  console.log(`🔗 Explorer: https://testnet.arcscan.app/address/${factoryAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
