import { NextResponse } from 'next/server';

const VAPI_API_KEY = process.env.VAPI_API_KEY;

// Simplified interface for assistant model
interface AssistantModel {
  provider?: string;
  model?: string;
  messages?: Array<{ role: string; content?: string }>;
  tools?: Array<{
    type: string;
    function?: {
      name?: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
    description?: string;
  }>;
  toolIds?: string[];
}

// Simplified interface for assistant data
interface Assistant {
  id: string;
  model?: AssistantModel;
}

export async function POST(request: Request) {
  // --- Basic Setup & Validation ---
  if (!VAPI_API_KEY) {
    console.error('[update-assistant-tool] VAPI_API_KEY is not set');
    return NextResponse.json({ error: 'Server configuration error: API key missing' }, { status: 500 });
  }

  let assistantId: string | undefined;
  let toolIdToAdd: string | undefined;

  try {
    const body = await request.json();
    assistantId = body.assistantId;
    toolIdToAdd = body.toolId;

    if (!assistantId || typeof assistantId !== 'string') {
      return NextResponse.json({ error: 'assistantId (string) is required in the request body' }, { status: 400 });
    }
    if (!toolIdToAdd || typeof toolIdToAdd !== 'string') {
      return NextResponse.json({ error: 'toolId (string) is required in the request body' }, { status: 400 });
    }

    console.log(`[update-assistant-tool] Request received for assistant ${assistantId} to add tool ${toolIdToAdd}`);

    // --- 1. Fetch current assistant configuration ---
    console.log('[update-assistant-tool] Fetching current config for assistant...');
    
    const fetchResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
      },
    });

    if (!fetchResponse.ok) {
      const errorBody = await fetchResponse.text();
      console.error(`[update-assistant-tool] Failed to fetch assistant ${assistantId}. Status: ${fetchResponse.status}, Body: ${errorBody}`);
      return NextResponse.json({
        error: `Vapi API Error: Failed to fetch assistant. Status: ${fetchResponse.status}`,
        details: errorBody
      }, { status: fetchResponse.status });
    }
    
    const currentAssistant: Assistant = await fetchResponse.json();
    console.log('[update-assistant-tool] Successfully fetched current config.');

    // --- 2. Prepare PATCH payload ---
    // Ensure model object exists, provide defaults if necessary
    const currentModel = currentAssistant.model || { provider: 'openai', model: 'gpt-4o' };

    // Get existing toolIds, ensure it's an array, handle null/undefined
    const existingToolIds = Array.isArray(currentModel.toolIds) ? currentModel.toolIds : [];

    // Add the new toolId, avoiding duplicates
    const updatedToolIdsSet = new Set([...existingToolIds, toolIdToAdd]);
    const finalToolIds = Array.from(updatedToolIdsSet);

    // Construct the payload for PATCH - *only include the model part*
    // Vapi's PATCH should merge this with the existing assistant data
    const updatePayload = {
      model: {
        ...currentModel,   // Keep existing model properties (provider, model name, messages, *transient tools*)
        toolIds: finalToolIds, // Set the new, combined array of tool IDs
      },
      // DO NOT include other top-level assistant properties unless you intend to update them.
      // PATCH should merge the 'model' object.
    };

    console.log(`[update-assistant-tool] Preparing to PATCH assistant ${assistantId} with toolIds: ${finalToolIds.join(', ')}`);
    console.log('[update-assistant-tool] Full PATCH payload (model part):', JSON.stringify(updatePayload, null, 2));

    // --- 3. Send PATCH request ---
    console.log(`[update-assistant-tool] Sending PATCH request for assistant ${assistantId}...`);
    
    const updateResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    const responseData = await updateResponse.json();

    if (!updateResponse.ok) {
      console.error(`[update-assistant-tool] Vapi API Error (Update Assistant ${assistantId}): ${updateResponse.status}`, responseData);
      return NextResponse.json({ 
        error: `Failed to update assistant: ${responseData.message || updateResponse.statusText}` 
      }, { status: updateResponse.status });
    }

    console.log(`[update-assistant-tool] Successfully updated assistant ${assistantId}.`);
    return NextResponse.json({ success: true, assistant: responseData });

  } catch (error) {
    console.error('[update-assistant-tool] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error during assistant update';
    // Include assistantId in error response if available
    const errorResponse = assistantId
        ? { error: `Internal Server Error updating assistant ${assistantId}`, details: message }
        : { error: 'Internal Server Error', details: message };
    return NextResponse.json(errorResponse, { status: 500 });
  }
} 