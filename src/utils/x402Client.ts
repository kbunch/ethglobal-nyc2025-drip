import axios from "axios";
import { baseSepolia } from "viem/chains";
import { withPaymentInterceptor } from "x402-axios";
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
  const account = await toViemAccount(evmAccount);

  // Create axios instance with payment interceptor
  const axiosInstance = axios.create({ baseURL });
  
  // Set up payment interceptor with viem account
  // The x402-axios library will handle 402 responses automatically
  const paymentRequirementsSelector = (paymentRequirements: PaymentRequirements[]) => {
    // Return the first available payment requirement with our metadata
    const selectedPayment = paymentRequirements[0];
    if (selectedPayment) {
      return {
        ...selectedPayment,
        resource: resource || `${method} ${path}`,
        mimeType: mimeType || "application/json",
        maxTimeoutSeconds: maxTimeoutSeconds || 30,
      };
    }
    return selectedPayment;
  };
  const fetchWithPayment = withPaymentInterceptor(axiosInstance, account, paymentRequirementsSelector);

  try {
    console.log(`Making ${method} request to ${baseURL}${path}`);

    // Make the request (interceptor and x402 library will handle payment flow)
    const response = await fetchWithPayment(path, {
      method,
      params: queryParams,
      data: body,
    });

    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Extract settlement info from X-PAYMENT-RESPONSE header
    let settlementInfo: SettlementInfo | undefined;
    const paymentResponseHeader =
      response.headers["x-payment-response"] || response.headers["X-PAYMENT-RESPONSE"];
    if (paymentResponseHeader) {
      try {
        settlementInfo = JSON.parse(atob(paymentResponseHeader));
        console.log(`Settlement info captured:`, settlementInfo);
      } catch (error) {
        console.warn("Failed to parse X-PAYMENT-RESPONSE header:", error);
      }
    }

    return {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      headers: response.headers,
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
