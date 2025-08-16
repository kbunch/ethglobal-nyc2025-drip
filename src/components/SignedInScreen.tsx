"use client";

import { useEvmAddress, useIsSignedIn, useCurrentUser } from "@coinbase/cdp-hooks";
import { toViemAccount } from "@coinbase/cdp-core";
import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPublicClient, createWalletClient, http, formatEther, formatUnits, erc20Abi } from "viem";
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
  
  const getBalancesRef = useRef<(() => Promise<void>) | null>(null);
  
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

  // Store the latest getBalances function in a ref
  getBalancesRef.current = getBalances;

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
    console.log('Current USDC balance:', formattedUsdc);
    console.log('Current ETH balance:', formattedEth);
    
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

    // Check if user has enough USDC balance
    if (!usdcBalance || usdcBalance < 1000n) {
      setApiError(`Insufficient USDC balance. You have ${formattedUsdc}, but need $0.001 (1000 units) for this payment.`);
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
      
      // Use wrapFetchWithPayment to automatically handle 402 responses
      // The CDP account from toViemAccount should be compatible with x402
      const fetchWithPayment = wrapFetchWithPayment(fetch, account);
      
      console.log('Making API request with x402 payment handling...');
      const response = await fetchWithPayment('/api/validate', {
        method: 'GET',
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        // Success response
        const body = await response.json();
        console.log('Success response:', body);
        
        setApiResult({
          status: response.status,
          data: body
        });
      } else {
        // Handle other errors
        const errorData = await response.json();
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
    if (evmAddress) {
      getBalances();
      const interval = setInterval(() => {
        if (getBalancesRef.current) {
          getBalancesRef.current();
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [evmAddress]);

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
            
            {/* Account Information */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <h3 className="font-semibold mb-2">Account Information:</h3>
              <div className="text-sm space-y-1">
                <p><strong>EVM Address:</strong> {evmAddress}</p>
                <p><strong>ETH Balance:</strong> {formattedEth || 'Loading...'}</p>
                <p><strong>USDC Balance:</strong> {formattedUsdc || 'Loading...'}</p>
                <p><strong>Required USDC:</strong> $0.001 (1000 units)</p>
                <p><strong>Payment Status:</strong> {usdcBalance && usdcBalance >= 1000n ? '✅ Sufficient' : '❌ Insufficient'}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <button
                onClick={testX402API}
                disabled={apiLoading || !currentUser?.evmAccounts?.length || !usdcBalance || usdcBalance < 1000n}
                className="w-full bg-green-500 text-white p-2 rounded-md hover:bg-green-600 disabled:bg-gray-400"
              >
                {apiLoading ? 'Testing...' : 'Test x402 Payment API'}
              </button>

              {!apiLoading && usdcBalance && usdcBalance < 1000n && (
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
                  <strong>Insufficient USDC Balance:</strong> You need at least $0.001 USDC to test this API. 
                  Current balance: {formattedUsdc}
                </div>
              )}

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
