"use client";

import { useEvmAddress, useIsSignedIn, useCurrentUser } from "@coinbase/cdp-hooks";
import { toViemAccount } from "@coinbase/cdp-core";
import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPublicClient, http, formatEther, formatUnits, erc20Abi } from "viem";
import { baseSepolia } from "viem/chains";

import Header from "@/components/Header";
import Transaction from "@/components/Transaction";
import UserBalance from "@/components/UserBalance";

/**
 * Create a viem client to access user's balance on the Base Sepolia network
 */
const client = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

interface ApiResult {
  status: number;
  data: Record<string, unknown>;
  paymentResponse?: Record<string, unknown>;
  message?: string;
}

/**
 * The Signed In screen
 */
export default function SignedInScreen() {
  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();
  const { currentUser } = useCurrentUser();
  const [ethBalance, setEthBalance] = useState<bigint | undefined>(undefined);
  const [usdcBalance, setUsdcBalance] = useState<bigint | undefined>(undefined);
  
  // x402 API test state
  const [apiResult, setApiResult] = useState<ApiResult | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  
  const getBalances = useCallback(async () => {
    if (!evmAddress) return;
  
    // ETH balance
    const ethBal = await client.getBalance({
      address: evmAddress,
    });
    setEthBalance(ethBal);
  
    // USDC balance
    const usdcBal: bigint = await client.readContract({
      address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [evmAddress],
    });
    
    console.log("usdcBal", usdcBal);
    setUsdcBalance(usdcBal);
  }, [evmAddress]);

  const formattedEth = useMemo(() => {
    if (ethBalance === undefined) return undefined;
    return formatEther(ethBalance);
  }, [ethBalance]);
  
  const formattedUsdc = useMemo(() => {
    if (usdcBalance === undefined) return undefined;
    // USDC has 6 decimals
    const formattedAmount = formatUnits(usdcBalance, 6);
    return `$${Number(formattedAmount).toFixed(2)}`;
  }, [usdcBalance]);

  // x402 API test function
  const testX402API = useCallback(async () => {
    console.log('testX402API called');
    console.log('currentUser:', currentUser);
    console.log('evmAccounts:', currentUser?.evmAccounts);
    
    if (!currentUser) {
      setApiError('No current user available. Please ensure you are signed in.');
      return;
    }

    if (!currentUser.evmAccounts) {
      setApiError('No EVM accounts available. Please ensure you have a wallet set up.');
      return;
    }

    if (currentUser.evmAccounts.length === 0) {
      setApiError('No EVM accounts available. Please ensure you have a wallet set up.');
      return;
    }

    setApiLoading(true);
    setApiError('');
    setApiResult(null);

    try {
      // Get the first EVM account and convert it to a viem account
      const evmAccount = currentUser.evmAccounts[0];
      console.log('EVM Account:', evmAccount);
      
      const account = await toViemAccount(evmAccount);
      console.log('Viem Account:', account);
      
      // Step 1: Make initial request
      console.log('Making initial API request...');
      const initialResponse = await fetch('/api/validate', {
        method: 'GET',
      });

      console.log('Initial response status:', initialResponse.status);
      
      if (initialResponse.status === 402) {
        // Payment required - handle manually
        console.log('Payment required, handling manually...');
        const paymentData = await initialResponse.json();
        console.log('Payment data:', paymentData);
        
        // For now, just show the payment requirements
        setApiResult({
          status: 402,
          data: paymentData,
          message: 'Payment required - manual handling not yet implemented'
        });
        
        // TODO: Implement manual payment flow using x402 core library
        // This would involve:
        // 1. Creating payment header using x402 core functions
        // 2. Signing the payment with the viem account
        // 3. Retrying the request with the payment header
        
      } else if (initialResponse.ok) {
        // Success response
        const body = await initialResponse.json();
        console.log('Success response:', body);
        
        setApiResult({
          status: initialResponse.status,
          data: body
        });
      } else {
        // Other error
        const errorData = await initialResponse.json();
        setApiError(`API Error: ${errorData.error || 'Unknown error'}`);
      }

    } catch (err: unknown) {
      console.error('API Error:', err);
      console.error('Error type:', typeof err);
      console.error('Error constructor:', err?.constructor?.name);
      console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      
      // Handle different types of errors
      if (err && typeof err === 'object' && 'response' in err) {
        const errorObj = err as { response?: { data?: { error?: string } } };
        if (errorObj.response?.data?.error) {
          setApiError(`API Error: ${errorObj.response.data.error}`);
        } else {
          setApiError('An API error occurred');
        }
      } else if (err instanceof Error) {
        setApiError(`Error: ${err.message}`);
      } else {
        setApiError('An unexpected error occurred');
      }
    } finally {
      setApiLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    getBalances();
    const interval = setInterval(getBalances, 500);
    return () => clearInterval(interval);
  }, [getBalances]);

  return (
    <>
      <Header />
      <main className="main flex-col-container flex-grow">
        <div className="main-inner flex-col-container">
            <div className="card card--user-balance">
                <UserBalance balance={formattedEth} asset="eth" />
                <UserBalance balance={formattedUsdc} asset="usdc" />
            </div>
          <div className="card card--transaction">
            {isSignedIn && evmAddress && (
              <Transaction balance={formattedEth} onSuccess={getBalances} />
            )}
          </div>
          
          {/* x402 API Test Section */}
          <div className="card">
            <h2 className="card-title">x402 Payment API Test</h2>
            <p className="text-sm text-gray-600 mb-4">
              Test the x402 payment integration with automatic payment handling using your CDP wallet.
            </p>
            
            <div className="space-y-4">
              <button
                onClick={testX402API}
                disabled={apiLoading || !currentUser?.evmAccounts?.length}
                className="w-full bg-green-500 text-white p-2 rounded-md hover:bg-green-600 disabled:bg-gray-400"
              >
                {apiLoading ? 'Testing...' : 'Test x402 Payment API'}
              </button>

              {apiError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {apiError}
                </div>
              )}

              {apiResult && (
                <div className="bg-gray-100 p-4 rounded-md">
                  <h3 className="font-semibold mb-2">API Response:</h3>
                  <pre className="text-sm overflow-auto">
                    {JSON.stringify(apiResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-4 p-4 bg-blue-100 border border-blue-400 rounded-md">
              <h3 className="font-semibold mb-2">How It Works:</h3>
              <ol className="text-sm space-y-1">
                <li>1. Click &quot;Test x402 Payment API&quot;</li>
                <li>2. x402-fetch automatically handles 402 Payment Required responses</li>
                <li>3. Payment is completed using your CDP wallet</li>
                <li>4. Request is retried with X-PAYMENT header</li>
                <li>5. Receive success response with timestamp</li>
              </ol>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
