/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { VapiClient } from '@vapi-ai/server-sdk';
import type { ToolUpdatePayload } from '@/app/types/vapi';

const VAPI_API_KEY = process.env.VAPI_API_KEY;

export async function POST(request: Request) {
  // Basic validation check
  if (!VAPI_API_KEY) {
    console.error("VAPI_API_KEY is not set in environment variables.");
    return NextResponse.json({ error: 'Server configuration error: API key missing' }, { status: 500 });
  }

  try {
    // Parse request body
    const body = await request.json() as { updatePayload: ToolUpdatePayload };
    const { updatePayload } = body;

    // Validate required fields
    if (!updatePayload || !updatePayload.id || !updatePayload.type) {
      return NextResponse.json({ 
        error: 'Missing required fields: toolId and type are required' 
      }, { status: 400 });
    }

    const { id: toolId, ...toolData } = updatePayload;
    console.log(`[update-tool] Updating tool ${toolId} with data:`, toolData);

    // Initialize Vapi Client
    const vapi = new VapiClient({ token: VAPI_API_KEY });

    // Update the tool
    // Use type assertion to bypass TypeScript checking since we know our data structure is valid
    // for Vapi's API but TypeScript definitions might be stricter
    const updatedTool = await vapi.tools.update(toolId, toolData as any);
    
    if (!updatedTool) {
      console.log(`[update-tool] Failed to update tool ${toolId}`);
      return NextResponse.json({ error: 'Failed to update tool' }, { status: 500 });
    }

    console.log(`[update-tool] Successfully updated tool ${toolId}`);
    return NextResponse.json({ success: true, tool: updatedTool });
  } catch (error) {
    // Log and return error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("[update-tool] Error updating tool:", errorMessage);
    return NextResponse.json({ error: 'Failed to update tool' }, { status: 500 });
  }
} 