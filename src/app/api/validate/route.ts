import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // If middleware passes, payment was successful
  // Return your JSON response
  return NextResponse.json({ success: true });
}