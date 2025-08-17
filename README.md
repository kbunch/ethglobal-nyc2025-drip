# drip - a streaming payments POC

This project was generated with [`@coinbase/create-cdp-app`](https://coinbase.github.io/cdp-web/modules/_coinbase_create-cdp-app.html) using the Next.js template.



## Getting Started

First, make sure you have your CDP Project ID:

1. Sign in or create an account on the [CDP Portal](https://portal.cdp.coinbase.com)
2. Copy your Project ID from the dashboard
3. Go to the [Embedded Wallets CORS settings](https://portal.cdp.coinbase.com/products/embedded-wallets/cors)
4. Click add origin and whitelist `http://localhost:3000` (or wherever your app will run)

Then, copy the `env.example` file to `.env`, and populate the `NEXT_PUBLIC_CDP_PROJECT_ID` with your project id.

Now you can start the development server:


Using pnpm:
```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your app.

## Features

This template comes with:
- Next.js 15 App Router
- CDP React components for authentication and wallet management
- Example transaction components for Base Sepolia
- Built-in TypeScript support
- ESLint with Next.js configuration
- Viem for type-safe Ethereum interactions

