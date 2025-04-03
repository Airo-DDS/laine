import { NextResponse } from 'next/server';

const VAPI_API_KEY = process.env.VAPI_API_KEY;

export async function POST(request: Request) {
  if (!VAPI_API_KEY) {
    console.error('VAPI_API_KEY is not set');
    return NextResponse.json({ error: 'Server configuration error: API key missing' }, { status: 500 });
  }

  try {
    const { assistantId, toolId } = await request.json();

    if (!assistantId || typeof assistantId !== 'string') {
      return NextResponse.json({ error: 'assistantId is required' }, { status: 400 });
    }
    if (!toolId || typeof toolId !== 'string') {
      return NextResponse.json({ error: 'toolId is required' }, { status: 400 });
    }

    console.log(`Fetching current configuration for assistant ${assistantId} to add tool ${toolId}...`);

    // --- 1. Fetch current assistant config ---
    const fetchResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
      },
    });

    if (!fetchResponse.ok) {
      const errorBody = await fetchResponse.text();
      console.error(`Failed to fetch assistant ${assistantId}. Status: ${fetchResponse.status}, Body: ${errorBody}`);
      return NextResponse.json({
        error: `Vapi API Error: Failed to fetch assistant. Status: ${fetchResponse.status}`,
        details: errorBody
      }, { status: fetchResponse.status });
    }
    const currentAssistant = await fetchResponse.json();
    console.log(`Successfully fetched current configuration for assistant ${assistantId}.`);


    // --- 2. Prepare PATCH payload ---
    // Ensure model object exists
    const currentModel = currentAssistant.model || { provider: 'openai', model: 'gpt-4o' }; // Provide defaults if model is missing

    // Get existing toolIds, ensure it's an array
    const existingToolIds = Array.isArray(currentModel.toolIds) ? currentModel.toolIds : [];

    // Add the new toolId, avoiding duplicates
    const newToolIds = [...new Set([...existingToolIds, toolId])];

    const updatePayload = {
      model: {
        ...currentModel, // Spread existing model properties
        toolIds: newToolIds, // Set the updated toolIds array
      },
      // Include other assistant properties if you need to update them simultaneously
      // name: currentAssistant.name, // Example: keep the name the same
      // voice: currentAssistant.voice, // Example: keep the voice the same
    };

    console.log(`Updating assistant ${assistantId} with new toolIds: ${newToolIds.join(', ')}`);

    // --- 3. Send PATCH request ---
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
      console.error(`Vapi API Error (Update Assistant ${assistantId}): ${updateResponse.status}`, responseData);
      return NextResponse.json({ error: `Failed to update assistant: ${responseData.message || updateResponse.statusText}` }, { status: updateResponse.status });
    }

    console.log(`Successfully updated assistant ${assistantId}.`);
    return NextResponse.json({ success: true, assistant: responseData });

  } catch (error) {
    console.error('Error in /api/update-assistant-tool:', error);
     const message = error instanceof Error ? error.message : 'Unknown error during assistant update';
    return NextResponse.json({ error: 'Internal Server Error', details: message }, { status: 500 });
  }
} 