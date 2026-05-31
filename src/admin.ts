import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  Address, 
  PublicClient, 
  WalletClient, 
  parseUnits
} from "viem";
import { privateKeyToAccount, Account } from "viem/accounts";
import { ArcShieldConfig } from "./types";
import { ARC_SHIELD_ABI } from "./abi";
import { arcTestnet } from "./client";

/**
 * Admin class for human owners to manage the security policy rules of their ArcShield vault.
 * Requires the owner's private key to execute transactions.
 */
export class ArcShieldAdmin {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private account: Account;
  private contractAddress: Address;

  constructor(config: ArcShieldConfig) {
    this.contractAddress = config.contractAddress;
    this.account = privateKeyToAccount(config.privateKey);

    this.publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(config.rpcUrl),
    }) as any;

    this.walletClient = createWalletClient({
      account: this.account,
      chain: arcTestnet,
      transport: http(config.rpcUrl),
    }) as any;
  }

  private parseUSDC(amount: number): bigint {
    return parseUnits(amount.toString(), 6);
  }

  /**
   * Adds or removes a destination address from the allowlist.
   * @param target Address of the destination API or recipient.
   * @param allowed True to whitelist, false to blacklist.
   */
  async setAllowlist(target: Address, allowed: boolean): Promise<`0x${string}`> {
    const { request } = await this.publicClient.simulateContract({
      account: this.account,
      address: this.contractAddress,
      abi: ARC_SHIELD_ABI,
      functionName: "setAllowlist",
      args: [target, allowed],
    });

    return await this.walletClient.writeContract(request as any);
  }

  /**
   * Modifies the daily spending limit (in standard USDC format, e.g. 150.00).
   */
  async updateDailyLimit(newLimitUSDC: number): Promise<`0x${string}`> {
    const limitBigInt = this.parseUSDC(newLimitUSDC);

    const { request } = await this.publicClient.simulateContract({
      account: this.account,
      address: this.contractAddress,
      abi: ARC_SHIELD_ABI,
      functionName: "updateDailyLimit",
      args: [limitBigInt],
    });

    return await this.walletClient.writeContract(request as any);
  }

  /**
   * Modifies the maximum single transaction limit (in standard USDC format, e.g. 50.00).
   */
  async updateMaxTxAmount(newMaxUSDC: number): Promise<`0x${string}`> {
    const maxBigInt = this.parseUSDC(newMaxUSDC);

    const { request } = await this.publicClient.simulateContract({
      account: this.account,
      address: this.contractAddress,
      abi: ARC_SHIELD_ABI,
      functionName: "updateMaxTxAmount",
      args: [maxBigInt],
    });

    return await this.walletClient.writeContract(request as any);
  }

  /**
   * Rotates the authorized AI Agent signature key.
   */
  async updateAgent(newAgentAddress: Address): Promise<`0x${string}`> {
    const { request } = await this.publicClient.simulateContract({
      account: this.account,
      address: this.contractAddress,
      abi: ARC_SHIELD_ABI,
      functionName: "updateAgent",
      args: [newAgentAddress],
    });

    return await this.walletClient.writeContract(request as any);
  }

  /**
   * Toggles the emergency freeze lock. If locked, the agent is halted.
   */
  async setEmergencyLock(locked: boolean): Promise<`0x${string}`> {
    const { request } = await this.publicClient.simulateContract({
      account: this.account,
      address: this.contractAddress,
      abi: ARC_SHIELD_ABI,
      functionName: "setEmergencyLock",
      args: [locked],
    });

    return await this.walletClient.writeContract(request as any);
  }

  /**
   * Withdraws all USDC funds locked in the Guard contract to a safe cold wallet.
   */
  async withdrawFunds(recipientAddress: Address): Promise<`0x${string}`> {
    const { request } = await this.publicClient.simulateContract({
      account: this.account,
      address: this.contractAddress,
      abi: ARC_SHIELD_ABI,
      functionName: "withdrawFunds",
      args: [recipientAddress],
    });

    return await this.walletClient.writeContract(request as any);
  }
}
