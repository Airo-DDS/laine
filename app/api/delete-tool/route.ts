import { NextResponse } from 'next/server';
import { VapiClient } from '@vapi-ai/server-sdk';

const VAPI_API_KEY = process.env.VAPI_API_KEY;

export async function POST(request: Request) {
  // Basic validation check
  if (!VAPI_API_KEY) {
    console.error("VAPI_API_KEY is not set in environment variables.");
    return NextResponse.json({ error: 'Server configuration error: API key missing' }, { status: 500 });
  }

  try {
    // Parse request body
    const body = await request.json() as { toolId: string };
    const { toolId } = body;

    // Validate required fields
    if (!toolId) {
      return NextResponse.json({ error: 'Missing required field: toolId' }, { status: 400 });
    }

    console.log(`[delete-tool] Deleting tool ${toolId}`);

    // Initialize Vapi Client
    const vapi = new VapiClient({ token: VAPI_API_KEY });

    // Delete the tool
    await vapi.tools.delete(toolId);
    
    console.log(`[delete-tool] Successfully deleted tool ${toolId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    // Log and return error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("[delete-tool] Error deleting tool:", errorMessage);
    return NextResponse.json({ error: 'Failed to delete tool' }, { status: 500 });
  }
} 