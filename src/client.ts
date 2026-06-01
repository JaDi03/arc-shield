import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  Address, 
  PublicClient, 
  WalletClient, 
  parseUnits, 
  formatUnits
} from "viem";
import { privateKeyToAccount, Account } from "viem/accounts";
import { mainnet } from "viem/chains"; // We define a custom chain or use standard structure
import { ArcShieldConfig } from "./types";
import { ARC_SHIELD_ABI } from "./abi";

// Define Arc Testnet custom chain parameters for viem
export const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  network: "arc-testnet",
  nativeCurrency: {
    decimals: 18,
    name: "USDC",
    symbol: "USDC",
  },
  rpcUrls: {
    public: { http: ["https://rpc.testnet.arc.network"] },
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
} as const;

/**
 * Client class for AI agents to interact with their ArcShield contract guardrail.
 * This class abstracts the 6-decimal USDC calculations and exposes simple interfaces
 * to check limits, query the allowlist, and execute on-chain actions.
 */
export class ArcShieldClient {
  protected config: ArcShieldConfig;
  protected publicClient: PublicClient;
  protected walletClient: WalletClient;
  protected account: Account;
  protected contractAddress: Address;

  constructor(config: ArcShieldConfig) {
    this.config = config;
    this.contractAddress = config.contractAddress;
    this.account = privateKeyToAccount(config.privateKey);

    // Initialize viem public client for blockchain reads
    this.publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(config.rpcUrl),
    }) as any;

    // Initialize viem wallet client for signing and broadcasting txs
    this.walletClient = createWalletClient({
      account: this.account,
      chain: arcTestnet,
      transport: http(config.rpcUrl),
    }) as any;
  }

  /**
   * Helper to format 6-decimal USDC to float number.
   */
  private formatUSDC(value: bigint): number {
    return parseFloat(formatUnits(value, 6));
  }

  /**
   * Helper to parse float number to 6-decimal USDC bigint.
   */
  private parseUSDC(amount: number): bigint {
    return parseUnits(amount.toString(), 6);
  }

  /**
   * Executes a contract transaction or USDC transfer passing through the ArcShield security checks.
   * @param target Destination address (e.g. allowed API or receiver wallet).
   * @param amountUSDC Amount of USDC to send/approve (in standard format, e.g. 10.50).
   * @param data Optional ABI-encoded function call payload.
   * @returns The transaction hash.
   */
  async execute(
    target: Address,
    amountUSDC: number,
    data: `0x${string}` = "0x"
  ): Promise<`0x${string}`> {
    const amountBigInt = this.parseUSDC(amountUSDC);

    try {
      // Perform pre-flight read validations locally to revert earlier with clean error messages
      const isLocked = await this.isLocked();
      if (isLocked) {
        throw new Error("ArcShield: Emergency lock is active. Agent cannot execute actions.");
      }

      const isAllowed = await this.isAllowlisted(target);
      if (!isAllowed) {
        throw new Error(`ArcShield: Destination address ${target} is not in the allowlist.`);
      }

      const maxTx = await this.getMaxTxAmount();
      if (amountUSDC > maxTx) {
        throw new Error(`ArcShield: Transaction amount (${amountUSDC} USDC) exceeds single limit of ${maxTx} USDC.`);
      }

      const remainingDaily = await this.getRemainingDailyLimit();
      if (amountUSDC > remainingDaily) {
        throw new Error(`ArcShield: Transaction amount (${amountUSDC} USDC) exceeds remaining daily limit of ${remainingDaily} USDC.`);
      }

      // Write transaction execution in contract
      const { request } = await this.publicClient.simulateContract({
        account: this.account,
        address: this.contractAddress,
        abi: ARC_SHIELD_ABI,
        functionName: "executeAction",
        args: [target, amountBigInt, data],
      });

      const hash = await this.walletClient.writeContract(request as any);
      return hash;
    } catch (error: any) {
      // Trigger Telegram notification asynchronously (don't block the execution path)
      this.sendTelegramAlert(target, amountUSDC, error.message).catch((err) => {
        console.error("ArcShield SDK: Error sending Telegram alert:", err);
      });
      throw error;
    }
  }

  /**
   * Checks if a destination address is in the allowlist.
   */
  async isAllowlisted(address: Address): Promise<boolean> {
    const allowed = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARC_SHIELD_ABI,
      functionName: "isAllowlisted",
      args: [address],
    });
    return allowed as boolean;
  }

  /**
   * Retrieves the daily spending limit in human-readable USDC format.
   */
  async getDailyLimit(): Promise<number> {
    const limit = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARC_SHIELD_ABI,
      functionName: "dailyLimit",
    });
    return this.formatUSDC(limit as bigint);
  }

  /**
   * Retrieves the maximum single transaction limit in human-readable USDC format.
   */
  async getMaxTxAmount(): Promise<number> {
    const maxTx = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARC_SHIELD_ABI,
      functionName: "maxTxAmount",
    });
    return this.formatUSDC(maxTx as bigint);
  }

  /**
   * Retrieves the current daily spent amount in human-readable USDC format.
   */
  async getDailySpent(): Promise<number> {
    const spent = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARC_SHIELD_ABI,
      functionName: "dailySpent",
    });
    return this.formatUSDC(spent as bigint);
  }

  /**
   * Checks the remaining spending allowance of the agent for the current daily window.
   */
  async getRemainingDailyLimit(): Promise<number> {
    const limit = await this.getDailyLimit();
    const spent = await this.getDailySpent();
    return Math.max(0, limit - spent);
  }

  /**
   * Checks if the emergency freeze lock is active.
   */
  async isLocked(): Promise<boolean> {
    const locked = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARC_SHIELD_ABI,
      functionName: "isLocked",
    });
    return locked as boolean;
  }

  /**
   * Retrieves the address of the owner (human).
   */
  async getOwner(): Promise<Address> {
    const ownerAddr = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARC_SHIELD_ABI,
      functionName: "owner",
    });
    return ownerAddr as Address;
  }

  /**
   * Retrieves the address of the authorized AI Agent (bot).
   */
  async getAgent(): Promise<Address> {
    const agentAddr = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: ARC_SHIELD_ABI,
      functionName: "agent",
    });
    return agentAddr as Address;
  }

  /**
   * Helper to send an alert to Telegram when a policy check or transaction fails.
   */
  private async sendTelegramAlert(
    target: Address,
    amount: number,
    reason: string
  ): Promise<void> {
    const token = this.config.telegramBotToken || (typeof process !== "undefined" ? process.env.TELEGRAM_BOT_TOKEN : undefined);
    const chatId = this.config.telegramChatId || (typeof process !== "undefined" ? process.env.TELEGRAM_CHAT_ID : undefined);

    if (!token || !chatId) {
      return;
    }

    try {
      const message = `🚨 *[ArcShield Security Alert]*\n\n` +
        `*Status:* Transaction Blocked (Guardrail Triggered)\n` +
        `*Reason:* \`${reason}\`\n` +
        `*Target Wallet:* \`${target}\`\n` +
        `*Amount:* \`${amount} USDC\`\n` +
        `*Vault Contract:* \`${this.contractAddress}\`\n\n` +
        ` _Action was blocked securely at the action layer._`;

      if (typeof fetch === "function") {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: "Markdown",
          }),
        });
      }
    } catch (err) {
      console.error("ArcShield SDK: Failed to send Telegram webhook alert:", err);
    }
  }
}
