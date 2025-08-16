# x402 API Endpoint Integration

This project now includes a 402x API endpoint that requires payment via the x402 protocol before returning data.

## API Endpoint

**URL:** `/api/validate`  
**Method:** GET  
**Price:** $0.001 per request  
**Network:** Base Sepolia (testnet)

### Response Format

```json
{
  "success": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Example Usage

```bash
# First request (will return 402 Payment Required)
curl "http://localhost:3000/api/validate"

# After payment, retry with X-PAYMENT header
curl -H "X-PAYMENT: <payment_payload>" "http://localhost:3000/api/validate"
```

## Setup Instructions

### 1. Configure Your Wallet Address

Edit `src/app/api/validate/route.ts` and replace `RECEIVING_ADDRESS` with your actual wallet address:

```typescript
const RECEIVING_ADDRESS = "0xYourActualWalletAddress";
```

### 2. Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Visit `http://localhost:3000/test-api` to test the API endpoint

3. Make a request to the API - you'll receive a 402 Payment Required response with payment instructions

### 3. Production Setup (Mainnet)

To accept real payments on mainnet:

1. **Get CDP API Keys:**
   - Sign up at [cdp.coinbase.com](https://cdp.coinbase.com)
   - Create a new project
   - Generate API credentials
   - Set environment variables:
     ```bash
     CDP_API_KEY_ID=your-api-key-id
     CDP_API_KEY_SECRET=your-api-key-secret
     ```

2. **Update the Code:**
   - Uncomment the mainnet facilitator import
   - Change network from "base-sepolia" to "base"
   - Replace facilitator config with the mainnet facilitator

   ```typescript
   import { facilitator } from '@coinbase/x402';
   
   const paymentConfig = {
     "GET /api/validate": {
       price: "$0.001",
       network: "base", // Changed from "base-sepolia"
       // ... rest of config
     }
   };
   
   // Use mainnet facilitator
   const middleware = paymentMiddleware(
     RECEIVING_ADDRESS,
     paymentConfig,
     facilitator // Changed from facilitatorConfig
   );
   ```

## How It Works

1. **First Request:** Client makes a request to `/api/validate`
2. **Payment Required:** Server responds with HTTP 402 and payment instructions
3. **Payment Process:** Client completes payment using x402 protocol
4. **Payment Verification:** Client retries request with `X-PAYMENT` header containing proof
5. **Success Response:** Server verifies payment and returns success with timestamp

## Discovery

When using the CDP facilitator, your endpoint will be automatically listed in the x402 Bazaar discovery layer, making it discoverable by buyers and AI agents.

## Error Handling

The API includes comprehensive error handling for:
- Payment verification failures
- Internal server errors
- CORS requests

## Testing

Use the test page at `/test-api` to interactively test the API endpoint and see the payment flow in action.

## Dependencies

- `x402-express`: Payment middleware for Express/Next.js
- `@coinbase/x402`: Mainnet facilitator (for production)

## Resources

- [x402 Documentation](https://docs.cdp.coinbase.com/x402/quickstart-for-sellers)
- [CDP Developer Portal](https://cdp.coinbase.com)
- [x402 Bazaar](https://bazaar.x402.org) - Discovery layer for paid APIs
