"use client";

import { useEvmAddress, useIsSignedIn, useCurrentUser } from "@coinbase/cdp-hooks";
import { toViemAccount } from "@coinbase/cdp-core";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPublicClient, createWalletClient, http, formatEther, formatUnits, erc20Abi } from "viem";
import { baseSepolia } from "viem/chains";

import Header from "@/components/Header";
import UserBalance from "@/components/UserBalance";
import { makeX402Request, checkPaymentRequirements } from "@/utils/x402Client";
import { formatUSDC } from "@/utils/chainConfig";

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
  settlementInfo?: {
    transaction: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
  };
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
    // Use the consistent formatUSDC function
    return formatUSDC(usdcBalance.toString());
  }, [usdcBalance]);

  // x402 API test function using real implementation
  const testX402API = useCallback(async () => {
    console.log('testX402API called');
    console.log('currentUser:', currentUser);
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
      // Use the real x402 client to make the request
      const response = await makeX402Request(
        10, // $0.00
      );

      console.log('x402 Response:', response);
      
      setApiResult({
        status: response.status,
        data: response.data,
        settlementInfo: response.settlementInfo,
        message: 'Payment completed successfully'
      });

    } catch (err: unknown) {
      console.error('x402 API Error:', err);
      
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
  }, [currentUser, formattedUsdc, formattedEth, usdcBalance]);

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
                <UserBalance balance={formattedUsdc} asset="usdc" />
            </div>

          
          {/* x402 API Test Section */}
          <div className="card">
            <h2 className="card-title">Payment</h2>
            
            {/* Account Information */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="text-sm space-y-1">
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
                {apiLoading ? 'Processing Payment...' : 'Test x402 Payment API'}
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
                  
                  {apiResult.settlementInfo && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                      <h4 className="font-semibold mb-2">Payment Details:</h4>
                      <div className="text-sm space-y-1">
                        <p><strong>Transaction Hash:</strong> 
                          <a 
                            href={`https://sepolia.basescan.org/tx/${apiResult.settlementInfo.transaction}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline ml-1"
                          >
                            {apiResult.settlementInfo.transaction.slice(0, 10)}...{apiResult.settlementInfo.transaction.slice(-8)}
                          </a>
                        </p>
                        <p><strong>Amount:</strong> {formatUSDC(apiResult.settlementInfo.amount)}</p>
                        <p><strong>Asset:</strong> {apiResult.settlementInfo.asset}</p>
                        <p><strong>Network:</strong> {apiResult.settlementInfo.network}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>


          </div>
        </div>
      </main>
    </>
  );
}
