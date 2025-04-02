import { NextResponse } from 'next/server';

export async function GET() {
  const assistantId = process.env.VAPI_ASSISTANT_ID || '';
  
  return NextResponse.json({
    assistantId
  });
} 