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
  * `mocks/MockUSDC.sol`: ERC-20 mock token used to simulate USDC during local testing.
* `/src`: The TypeScript SDK (`ArcShieldClient` and `ArcShieldAdmin`).
* `/test`: Smart contract tests verifying all edge cases (daily limit window, locks, withdrawals, factory deployments).
* `/scripts`: Hardhat deployment automation scripts.
* `/example`: Executable scripts demonstrating local and testnet agent simulation runs.
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

### 4. Running Local Tests
Run the local test suite. This starts an in-memory EVM node, deploys the `MockUSDC` token and the `ArcShieldFactory`, and executes the complete security policy tests:
```bash
pnpm run test:contracts  # or npm run test:contracts
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
  rpcUrl: process.env.RPC, // Obtained from `arc-canteen rpc-url`
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

## 🛠️ Deploying to Arc Testnet

### Step 1: Set up Environment Variables
Create a `.env` file in the root of the project:
```bash
cp .env.example .env
```
Open `.env` and configure:
* `RPC`: Your Arc Testnet JSON-RPC endpoint (e.g. from `arc-canteen status` or `~/.arc-canteen/env`).
* `PRIVATE_KEY`: Your owner private key (the wallet that will deploy and own the Factory and Shields). **Make sure this account has some USDC for gas (request it from the [Circle Faucet](https://faucet.circle.com)).**

### Step 2: Deploy the Factory Contract
Deploy `ArcShieldFactory.sol` to Arc Testnet:
```bash
npx hardhat run scripts/deploy-factory.ts --network arcTestnet
```
Copy the printed **Factory Address** and add it to your `.env` file:
```bash
FACTORY_ADDRESS="0x..."
```

### Step 3: Run the Live Testnet Demo
Run the testnet integration demo. This script uses the SDK to deploy a fresh shield contract, whitelists a destination, and demonstrates prompt-injection defense live on the real Arc Testnet:
```bash
npx ts-node example/testnet-demo.ts
```

---

## 📄 License
This repository is released under the [MIT License](LICENSE).
