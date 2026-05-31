# 🛡️ arc-shield: On-Chain Security Guardrail for AI Agents on Arc Network

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
* `/src`: The TypeScript SDK (`ArcShieldClient` and `ArcShieldAdmin`).
* `/test`: Smart contract tests verifying all edge cases (daily limit window, locks, withdrawals).

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have Node.js (v18+) and npm installed.

### 2. Installation
Clone the repository and install the dependencies:
```bash
git clone https://github.com/<your-username>/arc-shield.git
cd arc-shield
npm install
```

### 3. Compilation
Compile the Solidity contracts using Hardhat:
```bash
npm run compile
```

### 4. Running Tests
Run the local test suite to verify spending limit resets and allowlist checks:
```bash
npm run test:contracts
```

---

## 💻 SDK Usage Example

Below is a quick demonstration of how to integrate the SDK into an AI agent workflow:

### Step 1: Admin configures the Guard rules (Owner)
The human owner sets limits and allowlists the target API.
```typescript
import { ArcShieldAdmin } from "arc-shield";

const admin = new ArcShieldAdmin({
  rpcUrl: process.env.RPC, // Obtained from `arc-canteen rpc-url`
  contractAddress: "0xYourShieldContractAddress",
  privateKey: process.env.OWNER_PRIVATE_KEY, // Human owner key
});

// Authorize a specific merchant/API target
await admin.setAllowlist("0xMerchantAPIAddress", true);

// Set spending limits: 100 USDC daily, max 30 USDC per transaction
await admin.updateDailyLimit(100.00);
await admin.updateMaxTxAmount(30.00);
```

### Step 2: Agent attempts to pay (Agent)
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

1. Sync your canteen developer environment:
   ```bash
   arc-canteen context sync
   ```
2. Export your RPC URL:
   ```bash
   source ~/.arc-canteen/env
   ```
3. Set your deployment environment variables in `.env` and deploy the contract using Hardhat scripts or your preferred deployment tool.

---

## 📄 License
This repository is released under the [MIT License](LICENSE).
