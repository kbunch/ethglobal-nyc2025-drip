import { baseSepolia } from "viem/chains";
import { wrapFetchWithPayment } from "x402-fetch";
import { PaymentRequirements } from "x402/types";
import { formatUSDC } from "./chainConfig";
import { checkUSDCBalanceForPaymentAtomic } from "./balanceChecker";
import { getCurrentUser, toViemAccount } from "@coinbase/cdp-core";

// Helper types for the x402 client
export type X402RequestParams = {
  baseURL: string;
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  queryParams?: Record<string, string>;
  body?: unknown;
  maxAmountPerRequest?: number;
  paymentRequirements?: PaymentRequirements[];
  resource?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
};

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
export async function makeX402Request({
  baseURL,
  path,
  method,
  queryParams,
  body,
  maxAmountPerRequest, // Used by checkPaymentRequirements helper function
  paymentRequirements, // Used by checkPaymentRequirements helper function
  resource,
  mimeType,
  maxTimeoutSeconds,
}: X402RequestParams) {
  // Silence unused variable warnings - these are used by helper functions or may be used in future
  void maxAmountPerRequest;
  void paymentRequirements;
  const user = await getCurrentUser();
  if (!user || !user.evmAccounts || user.evmAccounts.length === 0) {
    throw new Error("No CDP user or EVM accounts found");
  }

  const evmAccount = user.evmAccounts[0];
  console.log('EVM account details:', {
    address: evmAccount,
    type: typeof evmAccount
  });
  
  const account = await toViemAccount(evmAccount);
  console.log('Viem account created:', {
    address: account.address,
    type: account.type
  });

  // Try using x402-fetch instead of x402-axios for better reliability
  const fetchWithPayment = wrapFetchWithPayment(fetch, account);
  
  try {
    const fullUrl = `${baseURL}${path}`;
    console.log(`Making ${method} request to ${fullUrl}`);
    console.log('Request configuration:', { method, params: queryParams, data: body });

    // Build URL with query parameters
    let url = fullUrl;
    if (queryParams) {
      const searchParams = new URLSearchParams(queryParams);
      url += `?${searchParams.toString()}`;
    }

    // Make the request using x402-fetch
    const response = await fetchWithPayment(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    console.log('Response received:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    // If we get a 402, the interceptor should have handled it automatically
    if (response.status === 402) {
      console.log('Received 402 response - interceptor should have handled this');
      const responseText = await response.text();
      console.log('Response data:', responseText);
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const fullUrl = `${baseURL}${path}`;
    
    console.error(`Request failed: ${errorMessage}`);
    console.error(`URL: ${fullUrl}`);
    
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
