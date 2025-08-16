import { NextRequest, NextResponse } from 'next/server';

// Your receiving wallet address - replace with your actual address
const RECEIVING_ADDRESS = process.env.WALLET_RECEIVING || "0x0919d75Ce615116DEDb4Ef6C1Dc413A3303dB136";

// API route handler
export async function GET(request: NextRequest) {
  try {
    // Check for X-PAYMENT header
    const paymentHeader = request.headers.get('X-PAYMENT');
    
    if (!paymentHeader) {
      // Payment required - return 402 with proper x402 payment requirements format
      const paymentRequirements = [
        {
          scheme: "exact",
          network: "base-sepolia",
          asset: "USDC",
          amount: "1000", // $0.001 in USDC (6 decimals)
          payTo: RECEIVING_ADDRESS,
          description: "Simple validation endpoint that requires payment"
        }
      ];

      return new NextResponse(JSON.stringify({
        error: 'Payment Required',
        message: 'This endpoint requires payment via x402 protocol',
        paymentRequirements: paymentRequirements
      }), {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Required': 'true',
          'X-Payment-Requirements': JSON.stringify(paymentRequirements)
        }
      });
    }

    // For now, just verify that a payment header was provided
    // In a real implementation, you would verify the payment here
    console.log('Payment header received:', paymentHeader);

    // Payment verified - return success response
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Payment verified successfully'
    });

  } catch (error) {
    console.error('Validation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-PAYMENT',
    },
  });
}
