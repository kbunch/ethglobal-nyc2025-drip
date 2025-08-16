'use client';

import { useCurrentUser, useIsSignedIn } from "@coinbase/cdp-hooks";
import { toViemAccount } from "@coinbase/cdp-core";
import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";
import { useState, useCallback } from 'react';

interface ApiResult {
  status: number;
  data: Record<string, unknown>;
  paymentResponse?: Record<string, unknown>;
}

export default function TestAPI() {
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { isSignedIn } = useIsSignedIn();
  const { currentUser } = useCurrentUser();

  const testAPI = useCallback(async () => {
    if (!isSignedIn) {
      setError('Please sign in to test the API');
      return;
    }

    if (!currentUser || !currentUser.evmAccounts || currentUser.evmAccounts.length === 0) {
      setError('No EVM account available. Please ensure you have a wallet set up.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Get the first EVM account and convert it to a viem account
      const evmAccount = currentUser.evmAccounts[0];
      const account = await toViemAccount(evmAccount);
      
      // Create the wrapped fetch function
      const fetchWithPaymentFn = wrapFetchWithPayment(fetch, account);
      
      // Make the API request
      const response = await fetchWithPaymentFn('/api/validate', {
        method: 'GET',
      });

      // Parse the response
      const body = await response.json();
      
      // Check for payment response header
      const paymentResponseHeader = response.headers.get("x-payment-response");
      if (paymentResponseHeader) {
        const paymentResponse = decodeXPaymentResponse(paymentResponseHeader);
        setResult({
          status: response.status,
          data: body,
          paymentResponse: paymentResponse
        });
      } else {
        setResult({
          status: response.status,
          data: body
        });
      }

    } catch (err: unknown) {
      console.error('API Error:', err);
      
      // Handle different types of errors
      if (err && typeof err === 'object' && 'response' in err) {
        const errorObj = err as { response?: { data?: { error?: string } } };
        if (errorObj.response?.data?.error) {
          setError(`API Error: ${errorObj.response.data.error}`);
        } else {
          setError('An API error occurred');
        }
      } else if (err instanceof Error) {
        setError(`Error: ${err.message}`);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, currentUser]);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">x402 Validation API Test</h1>
      
      {!isSignedIn && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          Please sign in to test the API with automatic payment handling.
        </div>
      )}

      {isSignedIn && !currentUser?.evmAccounts?.length && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          No EVM account available. Please ensure you have a wallet set up.
        </div>
      )}
      
      <div className="space-y-4 mb-6">
        <button
          onClick={testAPI}
          disabled={loading || !isSignedIn || !currentUser?.evmAccounts?.length}
          className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? 'Testing...' : 'Test Validation Endpoint'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-gray-100 p-4 rounded-md">
          <h3 className="font-semibold mb-2">API Response:</h3>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div className="mt-8 p-4 bg-yellow-100 border border-yellow-400 rounded-md">
        <h3 className="font-semibold mb-2">API Details:</h3>
        <ul className="text-sm space-y-1">
          <li>• <strong>Endpoint:</strong> <code>/api/validate</code></li>
          <li>• <strong>Method:</strong> GET</li>
          <li>• <strong>Price:</strong> $0.001 per request</li>
          <li>• <strong>Network:</strong> Base Sepolia (testnet)</li>
          <li>• <strong>Response:</strong> Simple success validation</li>
        </ul>
      </div>

      <div className="mt-4 p-4 bg-blue-100 border border-blue-400 rounded-md">
        <h3 className="font-semibold mb-2">How It Works:</h3>
        <ol className="text-sm space-y-1">
          <li>1. Click &quot;Test Validation Endpoint&quot;</li>
          <li>2. x402-fetch automatically handles 402 Payment Required responses</li>
          <li>3. Payment is completed using your CDP wallet</li>
          <li>4. Request is retried with X-PAYMENT header</li>
          <li>5. Receive success response with timestamp</li>
        </ol>
      </div>

      <div className="mt-4 p-4 bg-green-100 border border-green-400 rounded-md">
        <h3 className="font-semibold mb-2">Features:</h3>
        <ul className="text-sm space-y-1">
          <li>• <strong>Automatic Payment:</strong> No manual payment handling required</li>
          <li>• <strong>CDP Integration:</strong> Uses your CDP wallet for payments</li>
          <li>• <strong>Error Handling:</strong> Comprehensive error messages</li>
          <li>• <strong>Payment Verification:</strong> Decodes payment response headers</li>
        </ul>
      </div>
    </div>
  );
}
