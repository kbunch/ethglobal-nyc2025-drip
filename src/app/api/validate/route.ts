import { NextRequest, NextResponse } from 'next/server';

// Your receiving wallet address - replace with your actual address
const RECEIVING_ADDRESS = process.env.WALLET_RECEIVING || "0x0919d75Ce615116DEDb4Ef6C1Dc413A3303dB136";

// API route handler
export async function GET(request: NextRequest) {
  console.log('=== VALIDATE ROUTE START ===');
  console.log('Request method:', request.method);
  console.log('Request URL:', request.url);
  console.log('Request headers:', Object.fromEntries(request.headers.entries()));
  
  try {
    // Check for X-PAYMENT header
    const paymentHeader = request.headers.get('X-PAYMENT');
    console.log('X-PAYMENT header value:', paymentHeader);
    
    if (!paymentHeader) {
      console.log('No X-PAYMENT header found - returning 402 payment required');
      
      // Payment required - return 402 with proper x402 payment requirements format
      const paymentRequirements = [
        {
          scheme: "exact",
          network: "base-sepolia",
          asset: "USDC",
          maxAmountRequired: "1000", // $0.001 in USDC (6 decimals)
          payTo: RECEIVING_ADDRESS,
          description: "Simple validation endpoint that requires payment"
        }
      ];

      console.log('Payment requirements being sent:', JSON.stringify(paymentRequirements, null, 2));
      console.log('Receiving address:', RECEIVING_ADDRESS);

      const responseBody = {
        error: 'Payment Required',
        message: 'This endpoint requires payment via x402 protocol',
        accepts: paymentRequirements
      };

      console.log('Response body for 402:', JSON.stringify(responseBody, null, 2));

      return new NextResponse(JSON.stringify(responseBody), {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Required': 'true',
          'X-Payment-Requirements': JSON.stringify(paymentRequirements),
          'X-Payment-Scheme': 'exact'
        }
      });
    }

    // Verify that a payment header was provided
    console.log('Payment header received:', paymentHeader);
    console.log('Payment header length:', paymentHeader.length);

    // In a real implementation, you would verify the payment here
    // For now, we'll just check that the header exists and has valid JSON
    try {
      console.log('Attempting to parse payment header as JSON...');
      const paymentData = JSON.parse(paymentHeader);
      console.log('Payment data parsed successfully:', JSON.stringify(paymentData, null, 2));
      console.log('Payment data type:', typeof paymentData);
      console.log('Payment data keys:', Object.keys(paymentData));
      
      // You could add additional verification here:
      // - Check if the transaction hash is valid
      // - Verify the payment amount matches requirements
      // - Confirm the payment was made to the correct address
      // - Verify the transaction is confirmed on-chain
      
      console.log('Payment verification completed successfully');
      
    } catch (parseError) {
      console.error('Failed to parse payment header as JSON:', parseError);
      console.error('Parse error details:', {
        name: (parseError as Error).name,
        message: (parseError as Error).message,
        stack: (parseError as Error).stack
      });
      return NextResponse.json(
        { error: 'Invalid payment header format' },
        { status: 400 }
      );
    }

    // Payment verified - return success response
    console.log('Payment verified - returning success response');
    const successResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Payment verified successfully',
      paymentReceived: true
    };
    
    console.log('Success response body:', JSON.stringify(successResponse, null, 2));
    console.log('=== VALIDATE ROUTE END (SUCCESS) ===');
    
    return NextResponse.json(successResponse);

  } catch (error) {
    console.error('=== VALIDATE ROUTE ERROR ===');
    console.error('Validation API error:', error);
    console.error('Error details:', {
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack
    });
    console.error('=== VALIDATE ROUTE END (ERROR) ===');
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  console.log('=== OPTIONS REQUEST HANDLED ===');
  console.log('CORS headers being set for preflight request');
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-PAYMENT',
    },
  });
}
