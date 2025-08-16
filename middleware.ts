import { NextRequest, NextResponse } from "next/server";
import { paymentMiddleware } from "x402-next";

const RECEIVING_ADDRESS = "0xYourAddress"; // your receiving wallet address

// Create the payment middleware
export const middleware = paymentMiddleware(
  RECEIVING_ADDRESS,
  {
    // Protect specific routes
    "/api/validate": {
      price: "$0.001",
      network: "base-sepolia",
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
    url: "https://x402.org/facilitator", // testnet facilitator
  }
);

// Configure which routes to run middleware on
export const config = {
  matcher: ["/api/validate"],
};
