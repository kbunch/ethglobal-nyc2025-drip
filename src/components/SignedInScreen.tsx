"use client";

import { useEvmAddress, useCurrentUser } from "@coinbase/cdp-hooks";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPublicClient, http, formatEther, erc20Abi } from "viem";
import { baseSepolia } from "viem/chains";

import Header from "@/components/Header";
import UserBalance from "@/components/UserBalance";
import { makeX402Request } from "@/utils/x402Client";
import { formatUSDC } from "@/utils/chainConfig";

// localStorage keys
const STORAGE_KEYS = {
  TOTAL_ELAPSED_TIME: 'drip_total_elapsed_time',
  SESSION_SPENDING: 'drip_session_spending',
};

// localStorage utility functions
const saveToLocalStorage = (key: string, value: number) => {
  try {
    localStorage.setItem(key, value.toString());
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
};

const loadFromLocalStorage = (key: string, defaultValue: number = 0): number => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? Number(stored) : defaultValue;
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
    return defaultValue;
  }
};

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
  const { evmAddress } = useEvmAddress();
  const { currentUser } = useCurrentUser();
  const [ethBalance, setEthBalance] = useState<bigint | undefined>(undefined);
  const [usdcBalance, setUsdcBalance] = useState<bigint | undefined>(undefined);
  
  // x402 API test state
  const [apiResult, setApiResult] = useState<ApiResult | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  
  // Timer and recurring payment state
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [sessionSpending, setSessionSpending] = useState(0); // Track spending in cents (1000 units = 1 cent)
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [totalElapsedTime, setTotalElapsedTime] = useState(0); // Accumulated time across start/stop cycles
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const paymentIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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

  // Handler for making X402 requests and updating status
  const makePaymentRequest = useCallback(async () => {
    console.log('makePaymentRequest called');
    console.log('currentUser:', currentUser);
    console.log('Current USDC balance:', formattedUsdc);
    console.log('Current ETH balance:', formattedEth);
    
    if (!currentUser) {
      setApiError('No current user available. Please ensure you are signed in.');
      return false;
    }

    if (!currentUser.evmAccounts) {
      setApiError('No EVM accounts available. Please ensure you have a wallet set up.');
      return false;
    }

    if (currentUser.evmAccounts.length === 0) {
      setApiError('No EVM accounts available. Please ensure you have a wallet set up.');
      return false;
    }

    // Check if user has enough USDC balance
    if (!usdcBalance || usdcBalance < 1000n) {
      setApiError(`Insufficient USDC balance. You have ${formattedUsdc}, but need $0.001 (1000 units) for this payment.`);
      return false;
    }

    setApiLoading(true);
    
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
      
      setApiError('');
      // Increment session spending (1000 units = $0.001 = 0.1 cents)
      setSessionSpending(prev => prev + 1); // Add 1 cent per payment
      return true;

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
      
      return false;
    } finally {
      setApiLoading(false);
    }
  }, [currentUser, formattedUsdc, formattedEth, usdcBalance]);

  // Start/Stop button handler
  const handleStartStop = useCallback(async () => {
    if (isRunning) {
      // Stop the timer and intervals (accumulate elapsed time)
      
      // First, clear intervals to stop any updates
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      
      if (paymentIntervalRef.current) {
        clearInterval(paymentIntervalRef.current);
        paymentIntervalRef.current = null;
      }
      
      // Accumulate the elapsed time from this session
      if (sessionStartTime) {
        const currentSessionTime = Date.now() - sessionStartTime;
        const newTotalTime = totalElapsedTime + currentSessionTime;
        setTotalElapsedTime(newTotalTime);
        setElapsedTime(newTotalTime);
      }
      
      setIsRunning(false);
      setSessionStartTime(null);
    } else {
      // Start the timer immediately without initial payment
      const now = Date.now();
      setSessionStartTime(now);
      setIsRunning(true);
      
      // Start timer interval (updates every second)
      timerIntervalRef.current = setInterval(() => {
        const currentSessionTime = Date.now() - now;
        setElapsedTime(totalElapsedTime + currentSessionTime);
      }, 1000);
      
      // Start payment interval (first payment after 60 seconds)
      paymentIntervalRef.current = setInterval(async () => {
        await makePaymentRequest();
      }, 60000);
    }
  }, [isRunning, makePaymentRequest, sessionStartTime, totalElapsedTime]);

  // Reset session handler
  const handleResetSession = useCallback(() => {
    // Stop timer if running
    if (isRunning) {
      setIsRunning(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (paymentIntervalRef.current) {
        clearInterval(paymentIntervalRef.current);
        paymentIntervalRef.current = null;
      }
    }
    
    // Reset all session data
    setElapsedTime(0);
    setTotalElapsedTime(0);
    setSessionSpending(0);
    setSessionStartTime(null);
    setApiResult(null);
    setApiError('');
  }, [isRunning]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (paymentIntervalRef.current) {
        clearInterval(paymentIntervalRef.current);
      }
    };
  }, []);

  // Format elapsed time as MM:SS
  const formatElapsedTime = useCallback((milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  // Format currency for display
  const formatCurrency = useCallback((cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  }, []);

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
  }, [evmAddress, getBalances]);

  // Load persisted data on component mount
  useEffect(() => {
    const savedTotalElapsedTime = loadFromLocalStorage(STORAGE_KEYS.TOTAL_ELAPSED_TIME);
    const savedSessionSpending = loadFromLocalStorage(STORAGE_KEYS.SESSION_SPENDING);
    
    if (savedTotalElapsedTime > 0) {
      setTotalElapsedTime(savedTotalElapsedTime);
      setElapsedTime(savedTotalElapsedTime);
    }
    
    if (savedSessionSpending > 0) {
      setSessionSpending(savedSessionSpending);
    }
  }, []);

  // Save totalElapsedTime to localStorage whenever it changes
  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.TOTAL_ELAPSED_TIME, totalElapsedTime);
  }, [totalElapsedTime]);

  // Save sessionSpending to localStorage whenever it changes
  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.SESSION_SPENDING, sessionSpending);
  }, [sessionSpending]);

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
                <p>$0.001 per minute</p>
                <p><strong>Sufficient Funds:</strong> {usdcBalance && usdcBalance >= 1000n ? '✅' : '❌'}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Start/Stop Button */}
              <button
                onClick={handleStartStop}
                disabled={(!isRunning && apiLoading) || !currentUser?.evmAccounts?.length || !usdcBalance || usdcBalance < 1000n}
                className={`w-full text-white p-3 rounded-md font-medium ${
                  isRunning 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-green-500 hover:bg-green-600'
                } disabled:bg-gray-400`}
              >
                {(!isRunning && apiLoading) ? 'Processing Payment...' : isRunning ? 'Stop' : 'Start'}
              </button>

              {/* Timer Display */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <div className="flex justify-center">
                  <span className="text-lg font-mono">{formatElapsedTime(elapsedTime)}</span>
                </div>
                <div className="flex justify-center mt-2">
                  <span className="text-sm text-gray-600">{formatCurrency(sessionSpending)}</span>
                </div>
              </div>



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
            </div>


          </div>
        </div>
      </main>
    </>
  );
}
