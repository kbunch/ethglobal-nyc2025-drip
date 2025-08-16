# 402x Implementation Documentation

This project now includes a complete and valid 402x payment implementation that integrates with the Coinbase Developer Platform (CDP) wallet.

## Overview

The 402x implementation allows users to make API calls that require payment, with automatic handling of:
- 402 Payment Required responses
- USDC balance verification
- Transaction signing and submission
- Payment verification and retry logic

## Key Components

### 1. x402Client (`src/utils/x402Client.ts`)
The main utility for making HTTP requests with 402x payment handling:
- `makeX402Request()`: Makes requests with automatic payment handling
- `checkPaymentRequirements()`: Validates payment requirements before making requests

### 2. Balance Checker (`src/utils/balanceChecker.ts`)
Utilities for checking USDC balances:
- `checkUSDCBalanceForPaymentAtomic()`: Verifies sufficient USDC balance for payments
- `formatUSDC()`: Formats USDC amounts for display

### 3. Chain Configuration (`src/utils/chainConfig.ts`)
Network-specific utilities:
- `getBlockExplorerUrl()`: Generates block explorer URLs for transactions
- `getChain()`: Returns the appropriate chain (Base Sepolia for development)

### 4. API Route (`src/app/api/validate/route.ts`)
Example API endpoint that requires payment:
- Returns 402 status with payment requirements
- Accepts X-PAYMENT header with payment proof
- Validates payment and returns success response

### 5. UI Component (`src/components/SignedInScreen.tsx`)
User interface for testing 402x payments:
- Displays account balances
- Provides test button for 402x API calls
- Shows transaction details and block explorer links

## How It Works

1. **Initial Request**: User clicks "Test x402 Payment API"
2. **402 Response**: API returns 402 Payment Required with payment requirements
3. **Balance Check**: System verifies user has sufficient USDC balance
4. **Payment Creation**: x402-axios automatically creates and signs USDC transfer transaction
5. **Transaction Submission**: Transaction is submitted to Base Sepolia network
6. **Payment Verification**: Request is retried with X-PAYMENT header containing transaction proof
7. **Success Response**: API validates payment and returns success response

## Dependencies

- `x402-axios`: Core 402x payment handling library
- `@coinbase/cdp-core`: CDP wallet integration
- `@coinbase/cdp-hooks`: React hooks for CDP
- `viem`: Ethereum client library
- `axios`: HTTP client for requests

## Configuration

### Environment Variables
- `WALLET_RECEIVING`: Address to receive payments (defaults to example address)

### Network Configuration
- Currently configured for Base Sepolia testnet
- USDC contract: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Payment amount: 1000 units (0.001 USDC)

## Testing

1. Ensure you have a CDP wallet with USDC balance on Base Sepolia
2. Start the development server: `npm run dev`
3. Sign in with your CDP wallet
4. Click "Test x402 Payment API"
5. Approve the transaction in your wallet
6. View the transaction on Base Sepolia block explorer

## Real vs Mock Transactions

**Previous Implementation**: Used mock transaction hashes and didn't submit real transactions
**Current Implementation**: Creates and submits real USDC transfer transactions to Base Sepolia

The transactions will now appear on the Base Sepolia block explorer and can be verified as legitimate payments.

## Error Handling

The implementation includes comprehensive error handling for:
- Insufficient USDC balance
- Network errors
- Transaction failures
- Invalid payment requirements
- CDP wallet connection issues

## Security Considerations

- All transactions are signed by the user's CDP wallet
- Payment amounts are validated before submission
- Transaction hashes are verified and displayed
- Block explorer links are provided for transparency

## Future Enhancements

- Add support for multiple payment assets
- Implement payment amount discovery
- Add transaction confirmation tracking
- Support for different networks (Base mainnet)
- Enhanced error recovery mechanisms
