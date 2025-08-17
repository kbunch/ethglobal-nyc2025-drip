"use client";
import { LoadingSkeleton } from "@coinbase/cdp-react/components/ui/LoadingSkeleton";

interface Props {
  balance?: string;
  asset: "eth" | "usdc"; // expand as you add more
}

/**
 * A component that displays the user's balance for a given asset.
 */
export default function UserBalance({ balance, asset }: Props) {
  const assetMeta = {
    eth: { name: "Ethereum", icon: "/eth.svg" },
    usdc: { name: "USDC", icon: "/usdc.svg" }, // <- add a USDC icon in /public
  }[asset];

  return (
    <>
      <h2 className="card-title">Available {assetMeta.name} balance</h2>
      <p className="user-balance">
        {balance === undefined && (
          <LoadingSkeleton as="span" className="loading--balance" />
        )}
        {balance !== undefined && (
          <span className="flex-row-container">
            <img src={assetMeta.icon} alt={assetMeta.name} className="balance-icon" />
            <span>{balance}</span>
            <span className="sr-only">{assetMeta.name}</span>
          </span>
        )}
      </p>

      {asset === "eth" && (
        <p>
          Get testnet ETH from{" "}
          <a
            href="https://portal.cdp.coinbase.com/products/faucet"
            target="_blank"
            rel="noopener noreferrer"
          >
            Base Sepolia Faucet
          </a>
        </p>
      )}
      
      {asset === "usdc" && (
        <p>
          <a
            href="https://portal.cdp.coinbase.com/products/faucet"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Get More
          </a>
        </p>
      )}
    </>
  );
}
