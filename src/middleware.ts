import { Address } from "viem";
import { paymentMiddleware, Network, Resource } from "x402-next";

const facilitatorUrl = process.env.NEXT_PUBLIC_FACILITATOR_URL as Resource;
const RECEIVING_ADDRESS = process.env.WALLET_RECEIVING as Address; // your receiving wallet address
const network = process.env.NETWORK as Network;

// Create the payment middleware
export const middleware = paymentMiddleware(
  RECEIVING_ADDRESS,
  {
    // Protect specific routes
    "/api/validate": {
      price: "$0.001",
      network: network,
      config: {
        description: "Validation endpoint",
        outputSchema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
          },
        },
      },
    },
  },
  {
    url: facilitatorUrl, // for testnet
  }
);

// Configure which routes to run middleware on
export const config = {
  matcher: ["/api/validate"],
};
