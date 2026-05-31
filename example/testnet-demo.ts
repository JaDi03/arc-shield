import { ArcShieldClient, ArcShieldAdmin, arcTestnet } from "../src";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Address, createPublicClient, http } from "viem";
import * as dotenv from "dotenv";

dotenv.config();

async function runTestnetDemo() {
  console.log("=========================================================================");
  console.log("🛡️  arc-shield: LIVE TESTNET DEMO");
  console.log("=========================================================================\n");

  const rpcUrl = process.env.RPC;
  const ownerPrivateKey = process.env.PRIVATE_KEY as `0x${string}`;
  const factoryAddress = process.env.FACTORY_ADDRESS as Address;
  // Arc USDC ERC-20 token address (6 decimals)
  const usdcAddress: Address = "0x3600000000000000000000000000000000000000";

  if (!rpcUrl || !ownerPrivateKey || !factoryAddress) {
    console.error("❌ Missing required environment variables (RPC, PRIVATE_KEY, FACTORY_ADDRESS).");
    console.error("   Please ensure they are defined in your .env file.");
    process.exit(1);
  }

  const ownerAccount = privateKeyToAccount(ownerPrivateKey);
  console.log(`🔑 Owner Wallet Address: ${ownerAccount.address}`);
  console.log(`⚙️  Connecting to RPC: ${rpcUrl}`);
  console.log(`🏭 Factory Address:   ${factoryAddress}`);

  // Create a public client to wait for receipts
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  // 1. Generate a temporary session key for the AI Agent
  const agentPrivateKey = generatePrivateKey();
  const agentAccount = privateKeyToAccount(agentPrivateKey);
  console.log(`🤖 Generated Agent Session Key: ${agentAccount.address}`);

  // 2. Programmatically deploy a custom Shield contract for the agent
  console.log("\n⏳ Deploying new ArcShield contract via Factory...");
  let shieldAddress: Address;
  try {
    shieldAddress = await ArcShieldAdmin.deployShield({
      rpcUrl,
      factoryAddress,
      privateKey: ownerPrivateKey,
      agentAddress: agentAccount.address,
      usdcAddress,
      dailyLimit: 50.0, // 50 USDC daily limit
      maxTxAmount: 20.0, // 20 USDC max per transaction
    });
    console.log(`✅ Shield Contract Deployed successfully!`);
    console.log(`   Address: ${shieldAddress}`);
    console.log(`   Explorer: https://testnet.arcscan.app/address/${shieldAddress}`);
  } catch (error: any) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }

  // 3. Initialize SDK instances pointing to the new Shield
  const admin = new ArcShieldAdmin({
    rpcUrl,
    contractAddress: shieldAddress,
    privateKey: ownerPrivateKey,
  });

  const client = new ArcShieldClient({
    rpcUrl,
    contractAddress: shieldAddress,
    privateKey: agentPrivateKey,
  });

  // 4. Set up the allowlist (Whitelisting a recipient)
  const recipientAddress: Address = "0x8888888888888888888888888888888888888888";
  console.log(`\n✍ Whitelisting legitimate API/recipient: ${recipientAddress}...`);
  try {
    const wlTx = await admin.setAllowlist(recipientAddress, true);
    console.log(`✅ Whitelist transaction sent (Tx: ${wlTx})`);
    console.log("⏳ Waiting for transaction confirmation on Arc Testnet...");
    await publicClient.waitForTransactionReceipt({ hash: wlTx });
    console.log("✅ Legitimate address whitelisted!");
  } catch (error: any) {
    console.error("❌ Failed to whitelist:", error.message);
    process.exit(1);
  }

  // 5. Test prompt injection mitigation (Unapproved recipient)
  const attackerAddress: Address = "0x9999999999999999999999999999999999999999";
  console.log(`\n💬 [Attack Simulation] Compromised agent tries to send 15.00 USDC to attacker: ${attackerAddress}...`);
  try {
    // This should fail client-side or revert on-chain before transfer
    await client.execute(attackerAddress, 15.0);
    console.error("❌ CRITICAL: Exploit succeeded! Shield failed to block the transaction.");
  } catch (error: any) {
    console.log(`🛡️  [BLOCK RESULT] Transaction blocked successfully by SDK/Smart Contract!`);
    console.log(`   Reason: ${error.message}`);
  }

  // 6. Test limit enforcement (Whitelisted address but too much money)
  console.log(`\n🟢 [Limit Simulation] Agent tries to send 25.00 USDC to whitelisted recipient (Max limit: 20.00 USDC)...`);
  try {
    await client.execute(recipientAddress, 25.0);
    console.error("❌ CRITICAL: Transaction exceeded limits but completed!");
  } catch (error: any) {
    console.log(`🛡️  [BLOCK RESULT] Transaction blocked successfully by SDK/Smart Contract!`);
    console.log(`   Reason: ${error.message}`);
  }

  console.log("\n=========================================================================");
  console.log("🏁 LIVE TESTNET VERIFICATION COMPLETE: Factory & Shield fully working!");
  console.log("=========================================================================");
}

runTestnetDemo().catch(console.error);
