"use client";

import { useEvmAddress, useIsSignedIn } from "@coinbase/cdp-hooks";
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

/**
 * The Signed In screen
 */
export default function SignedInScreen() {
  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();
  const [ethBalance, setEthBalance] = useState<bigint | undefined>(undefined);
  const [usdcBalance, setUsdcBalance] = useState<bigint | undefined>(undefined);
  
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
        </div>
      </main>
    </>
  );
}
