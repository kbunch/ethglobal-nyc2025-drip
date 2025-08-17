import { baseSepolia } from "viem/chains";
import { wrapFetchWithPayment } from "x402-fetch";
import { PaymentRequirements } from "x402/types";
import { formatUSDC } from "./chainConfig";
import { checkUSDCBalanceForPaymentAtomic } from "./balanceChecker";
import { getCurrentUser, toViemAccount } from "@coinbase/cdp-core";


export interface SettlementInfo {
  transaction: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
}

/**
 * Makes an HTTP request with x402 payment handling capabilities.
 * Handles payment requirements, tracks operations, and manages payment flow.
 */
export async function makeX402Request(maxAmountPerRequest?: number) {
  // Silence unused variable warnings - these are used by helper functions or may be used in future
  const user = await getCurrentUser();

  if (!user || !user.evmAccounts || user.evmAccounts.length === 0) {
    throw new Error("No CDP user or EVM accounts found");
  }

  const evmAccount = user.evmAccounts[0];
  const account = await toViemAccount(evmAccount);

  // Try using x402-fetch instead of x402-axios for better reliability
  const fetchWithPayment = wrapFetchWithPayment(fetch, account);
  
  const url = '/api/validate';
  try {
    const response = await fetchWithPayment(url, {
      headers: {
        method: 'GET',
        'Content-Type': 'application/json',
      }
    });

    // If we get a 402, the interceptor should have handled it automatically
    if (response.status === 402) {
      throw new Error('Payment required but interceptor did not handle it');
    }

    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Extract settlement info from X-PAYMENT-RESPONSE header
    let settlementInfo: SettlementInfo | undefined;
    const paymentResponseHeader = response.headers.get("x-payment-response");
    if (paymentResponseHeader) {
      try {
        settlementInfo = JSON.parse(atob(paymentResponseHeader));
        console.log(`Settlement info captured:`, settlementInfo);
      } catch (error) {
        console.warn("Failed to parse X-PAYMENT-RESPONSE header:", error);
      }
    }

    const responseData = await response.json();

    return {
      status: response.status,
      statusText: response.statusText,
      data: responseData,
      headers: Object.fromEntries(response.headers.entries()),
      settlementInfo,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Check if payment requirements can be met before making request
 */
export async function checkPaymentRequirements(
  paymentRequirements: PaymentRequirements[],
  maxAmountPerRequest?: number
): Promise<{ canProceed: boolean; error?: string }> {
  if (!paymentRequirements || paymentRequirements.length === 0) {
    return { canProceed: true };
  }

  const selectedPayment = paymentRequirements[0];

  console.log('Selected payment:', selectedPayment);
  
  // Check max amount per request
  if (maxAmountPerRequest && selectedPayment) {
    const selectedPaymentAmount = Number(selectedPayment.maxAmountRequired);
    if (selectedPaymentAmount > maxAmountPerRequest) {
      const errorMessage = `Payment required: ${formatUSDC(
        selectedPayment.maxAmountRequired,
      )} is greater than max amount per request: ${formatUSDC(maxAmountPerRequest.toString())}`;
      return { canProceed: false, error: errorMessage };
    }
  }

  // Check balance
  const user = await getCurrentUser();
  if (!user || !user.evmAccounts || user.evmAccounts.length === 0) {
    return { canProceed: false, error: "No CDP user or EVM accounts found" };
  }

  const evmAccount = user.evmAccounts[0];
  const account = await toViemAccount(evmAccount);
  
  const balanceCheck = await checkUSDCBalanceForPaymentAtomic(
    account.address,
    selectedPayment.maxAmountRequired,
    baseSepolia,
  );

  if (!balanceCheck.isSufficient) {
    const errorMessage = `Insufficient USDC balance (need ${formatUSDC(
      selectedPayment.maxAmountRequired,
    )}, have ${balanceCheck.formattedBalance})`;
    return { canProceed: false, error: errorMessage };
  }

  return { canProceed: true };
}
