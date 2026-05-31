import { Address } from "viem";

/**
 * Configuration options for the ArcShield Client and Admin instances.
 */
export interface ArcShieldConfig {
  /**
   * The JSON-RPC endpoint URL for the Arc Network.
   */
  rpcUrl: string;
  
  /**
   * The deployed ArcShield smart contract address on-chain.
   */
  contractAddress: Address;
  
  /**
   * The private key of the calling party (either the Agent or the Owner).
   */
  privateKey: `0x${string}`;
}
