import { base, baseSepolia } from "viem/chains";

/**
 * Get block explorer URL for a transaction
 */
export function getBlockExplorerUrl(network: string, transactionHash: string): string {
  switch (network) {
    case "base":
      return `https://basescan.org/tx/${transactionHash}`;
    case "base-sepolia":
      return `https://sepolia.basescan.org/tx/${transactionHash}`;
    default:
      return `https://basescan.org/tx/${transactionHash}`;
  }
}

/**
 * Format USDC amount for display
 */
export function formatUSDC(amount: string): string {
  const num = Number(amount) / 1_000_000; // USDC has 6 decimals
  return `$${num.toFixed(6)}`;
}

/**
 * Get the appropriate chain based on environment
 */
export function getChain() {
  // Use testnet for development
  return baseSepolia;
}
