# 🛡️ arc-shield: On-Chain Security Guardrail for AI Agents on Arc Network

![arc-shield banner](./public/arc_shield_banner.png)

`arc-shield` is an open-source security primitive and developer starter kit for building safe, autonomous agentic commerce workflows on the **Arc Network** (Circle's stablecoin-native Layer-1 blockchain).

It combines a secure, policy-enforcing Solidity smart contract (`ArcShield.sol`) with a lightweight, developer-friendly TypeScript SDK (`arc-shield-sdk`) to constrain AI agent spending and transactions directly on-chain.

---

## 🧠 Motivation: The Fallacy of Prompt-Based Security

AI agents are rapidly becoming capable economic actors, holding tokens and executing on-chain transactions autonomously. However, giving an LLM-driven agent unchecked access to a private key is highly dangerous:

> [!WARNING]
> **The Grok Morse Code Incident (May 2026):**
> Recently, an autonomous AI agent was manipulated via a prompt injection attack using obfuscated Morse code in chat. The agent translated the Morse code, which instructed it to bypass its own safety prompts, and autonomously drained **$175,000 USD** worth of tokens to the attacker's wallet.

Prompt engineering (*"You are a helpful agent. Never transfer more than 10 USDC"* ) is **not a security boundary**. Attackers can bypass prompt-based guardrails using encoding (Base64, binary, Morse code) or indirect injection. 

### The Solution: Action-Layer Security
`arc-shield` implements a **defense-in-depth** architecture by moving security constraints out of the LLM's text-reasoning environment and pushing them to the **on-chain action layer**. Even if the LLM is completely compromised by a prompt injection, the blockchain smart contract will block any transaction that violates its spending limit or allowlist rules.

---

## 📐 Architecture & Flow

```
   ┌──────────────────────────────────────────────────────────┐
   │                  AI Agent Server (Node.js)               │
   │                                                          │
   │   ┌─────────────┐               ┌────────────────────┐   │
   │   │  LLM Brain  │ ──(action)──> │  ArcShieldClient   │   │
   │   └─────────────┘               └─────────┬──────────┘   │
   └───────────────────────────────────────────┼──────────────┘
                                               │ (signs tx)
                                               ▼
   ┌──────────────────────────────────────────────────────────┐
   │                       Arc Network                        │
   │                                                          │
   │              ┌──────────────────────────────────┐        │
   │              │          ArcShield.sol           │        │
   │              ├──────────────────────────────────┤        │
   │              │   • Daily Spending Limit Check   │        │
   │              │   • Max Tx Amount Check          │        │
   │              │   • Recipient Allowlist Check    │        │
   │              └────────────────┬─────────────────┘        │
   │                               │ (if valid)               │
   │                               ▼                          │
   │                     [ Target Recipient / API ]           │
   └──────────────────────────────────────────────────────────┘
```

---

## 📦 Project Structure

This project is structured as a **standalone, modular developer starter-kit**:
* `/contracts`: The Solidity security guardrail contracts.
  * `ArcShield.sol`: The core vault contract enforcing daily spending limits and allowed destinations.
  * `ArcShieldFactory.sol`: Deploys individual shield instances programmatically.
* `/src`: The TypeScript SDK (`ArcShieldClient` and `ArcShieldAdmin`).
* `/scripts`: Hardhat deployment automation scripts.
* `/example/dashboard`: A simple Web3 administration dashboard for owners to manage daily limits and allowlists.
* `/public`: Cover banner and documentation assets.

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have Node.js (v18+) and npm installed.

### 2. Installation
Clone the repository and install the dependencies:
```bash
git clone https://github.com/JaDi03/arc-shield.git
cd arc-shield

# Using pnpm (Recommended - cleaner installation without vulnerability spam)
pnpm install

# Or using npm
npm install
```

### 3. Compilation
Compile the Solidity contracts and generate TypeChain typings:
```bash
pnpm run compile  # or npm run compile
```

---

## 💻 SDK Usage Example

Below is a quick demonstration of how to integrate the SDK into an AI agent workflow:

### Step 1: Deploy a secure Shield Vault (Owner)
The human owner deploys a secure, isolated on-chain shield vault for their agent in one line of TypeScript code (using the pre-deployed factory contract on Arc Testnet):

```typescript
import { ArcShieldAdmin } from "arc-shield";

// Deploy the Shield Vault programmatically
const shieldAddress = await ArcShieldAdmin.deployShield({
  rpcUrl: process.env.RPC, // Arc Testnet RPC URL
  factoryAddress: "0x9c285B34f3489E7AF30712D25461D36Da21295c9", // Factory address
  privateKey: process.env.OWNER_PRIVATE_KEY, // Human owner key
  agentAddress: "0xYourAgentWalletAddress", // The bot's wallet address
  usdcAddress: "0x3600000000000000000000000000000000000000", // USDC on Arc Testnet
  dailyLimit: 100.00, // 100 USDC daily spending limit
  maxTxAmount: 30.00, // 30 USDC max limit per transaction
});

console.log("Shield Vault deployed at:", shieldAddress);
```

### Step 2: Manage Limits and Allowlist (Owner)
The human owner can manage rules, authorise merchant APIs, freeze operations, or withdraw funds from their admin instance:

```typescript
const admin = new ArcShieldAdmin({
  rpcUrl: process.env.RPC,
  contractAddress: shieldAddress, // The address returned in Step 1
  privateKey: process.env.OWNER_PRIVATE_KEY,
});

// Authorize a specific merchant/API target
await admin.setAllowlist("0xMerchantAPIAddress", true);

// Dynamically adjust spending limits if needed
await admin.updateDailyLimit(150.00);
```

### Step 3: Agent attempts to pay (Agent)
The AI agent uses its session key to execute transactions.
```typescript
import { ArcShieldClient } from "arc-shield";

const client = new ArcShieldClient({
  rpcUrl: process.env.RPC,
  contractAddress: "0xYourShieldContractAddress",
  privateKey: process.env.AGENT_SESSION_KEY, // Bot's temporary wallet key
});

// Case A: Transferring within limits to allowlisted address (SUCCEEDS)
const txHash = await client.execute("0xMerchantAPIAddress", 15.00);
console.log("Transaction sent successfully:", txHash);

// Case B: Hacker injects prompt to transfer to unapproved address (REVERTS on-chain)
try {
  await client.execute("0xAttackerWalletAddress", 10.00);
} catch (error) {
  console.error("Exploit Blocked:", error.message);
  // Prints: ArcShield: Destination address 0xAttackerWalletAddress is not in the allowlist.
}

// Case C: Agent attempts to spend more than the single transaction limit (REVERTS on-chain)
try {
  await client.execute("0xMerchantAPIAddress", 45.00); // Max single tx is 30.00
} catch (error) {
  console.error("Limit Enforced:", error.message);
  // Prints: ArcShield: Transaction amount (45 USDC) exceeds single limit of 30 USDC.
}
```

---

## 🎛️ Web3 Administration Dashboard

The human owner (`owner`) can manage security policies, whitelist/blacklist merchant addresses, update daily limits, freeze operations, and view audit trails via a zero-dependency static Web3 dashboard.

### How to use:
1. Open the [index.html](file:///c:/Users/USER/Desktop/idea/example/dashboard/index.html) file inside `/example/dashboard` in any web browser.
2. Click **Connect Wallet** and select your Web3 provider (MetaMask or Rabby). Ensure you are connected with the owner wallet address on Arc Testnet.
3. Paste the deployed **ArcShield contract address** and click **Read On-Chain Data**.
4. **Features Available:**
   - **Status Dashboard:** Shows owner/agent addresses, daily limits, max transaction size, daily amount spent, and remaining allowance.
   - **Activity Logs:** Automatically queries the blockchain and renders a visual timeline of all past transactions, whitelist changes, limit updates, and freeze locks.
   - **Manage Limits:** Easily adjust the daily spent limits and maximum single transaction limits.
   - **Allowlist Manager:** Add or revoke permissions for target addresses/merchant contracts.
   - **Emergency Freeze:** One-click button to trigger a panic lock, freezing all agent transactions instantly.

---

## 🚨 Passive Security Alerts (Telegram Bot)

`arc-shield` has native support for pushing real-time security alerts directly to a Telegram group or channel when a transaction is blocked (either by the SDK local pre-flight checks or on-chain reverts). 

This is fully passive and works without modifying the agent's code:

### How to set up:
1. Create a Telegram Bot using `@BotFather` and copy the **Bot Token**.
2. Add the bot to your Telegram group or channel, and get your **Chat ID** (e.g. using `@raw_data_bot`).
3. Add the keys to your agent's `.env` configuration file:
   ```bash
   TELEGRAM_BOT_TOKEN="123456789:ABCdefGh..."
   TELEGRAM_CHAT_ID="-100123456789"
   ```
4. The SDK will automatically fetch these environment variables and push alerts whenever a transaction fails policy checks.

---

## 🛠️ Deploying to Arc Testnet

### Step 1: Set up Environment Variables
Create a `.env` file in the root of the project:
```bash
cp .env.example .env
```
Open `.env` and configure:
* `RPC`: Your Arc Testnet JSON-RPC endpoint (e.g. `https://rpc.testnet.arc.network`).
* `PRIVATE_KEY`: Your owner private key (the wallet that will deploy and own the Factory and Shields). **Make sure this account has some USDC for gas (request it from the [Circle Faucet](https://faucet.circle.com)).**

### Step 2: Deploy the Factory Contract
Deploy `ArcShieldFactory.sol` to Arc Testnet:
```bash
# Using pnpm
pnpm hardhat run scripts/deploy-factory.ts --network arcTestnet

# Or using npx
npx hardhat run scripts/deploy-factory.ts --network arcTestnet
```
Copy the printed **Factory Address** and add it to your `.env` file:
```bash
FACTORY_ADDRESS="0x..."
```

---

## 📄 License
This repository is released under the [MIT License](LICENSE).
