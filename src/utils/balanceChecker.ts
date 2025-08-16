import { createPublicClient, http, parseUnits, publicActions, Address, Chain } from "viem";
import { getUSDCBalance } from "x402/shared/evm";

export interface BalanceCheckResult {
  isSufficient: boolean;
  formattedBalance: string;
  balance: bigint;
}

/**
 * Format USDC amount for display
 */
export function formatUSDC(amount: string): string {
  const num = Number(amount) / 1_000_000; // USDC has 6 decimals
  return `$${num.toFixed(6)}`;
}

/**
 * Check USDC balance for a given address
 */
export const checkUSDCBalance = async (address: Address, chain: Chain): Promise<bigint> => {
  if (!address) {
    return 0n;
  }

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  }).extend(publicActions);

  return await getUSDCBalance(publicClient, address);
};

/**
 * Check USDC balance and determine if sufficient for payment (atomic units version)
 */
export async function checkUSDCBalanceForPaymentAtomic(
  walletAddress: Address,
  requiredAmountAtomic: string,
  chain: Chain,
): Promise<BalanceCheckResult> {
  try {
    const publicClient = createPublicClient({
      chain,
      transport: http(),
    }).extend(publicActions);
    const currentBalance = await getUSDCBalance(publicClient, walletAddress);
    const requiredBigInt = BigInt(requiredAmountAtomic);

    const isSufficient = currentBalance >= requiredBigInt;
    const formattedBalance = formatUSDC(currentBalance.toString());

    console.log(
      `USDC Balance check (atomic): ${currentBalance} available, ${requiredBigInt} required (sufficient: ${isSufficient})`,
    );

    return {
      isSufficient,
      formattedBalance,
      balance: currentBalance,
    };
  } catch (error) {
    console.error("Failed to check USDC balance (atomic):", error);
    return {
      isSufficient: false,
      balance: 0n,
      formattedBalance: "0",
    };
  }
}
