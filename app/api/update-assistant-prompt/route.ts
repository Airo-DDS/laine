import { NextResponse } from 'next/server';

const VAPI_API_KEY = process.env.VAPI_API_KEY;
// Note: We get assistantId from the request body now, but keep VAPI_ASSISTANT_ID for potential fallback or validation if needed.
// const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;

// Define interface for message object
interface VapiMessage {
  role: string;
  content: string;
}

export async function POST(request: Request) {
  if (!VAPI_API_KEY) {
    console.error('VAPI_API_KEY is not set');
    return NextResponse.json({ error: 'Server configuration error: API key missing' }, { status: 500 });
  }

  try {
    const { assistantId, newPrompt } = await request.json();

    if (!assistantId || typeof assistantId !== 'string') {
      return NextResponse.json({ error: 'assistantId is required in the request body' }, { status: 400 });
    }
    if (typeof newPrompt !== 'string') { // Allow empty string but require the key
      return NextResponse.json({ error: 'newPrompt (string) is required in the request body' }, { status: 400 });
    }

    console.log(`Fetching current config for assistant ${assistantId} before updating prompt...`);

    // --- 1. Fetch current assistant config ---
    const fetchResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` },
    });

    if (!fetchResponse.ok) {
      const errorBody = await fetchResponse.text();
      console.error(`Failed to fetch assistant ${assistantId}. Status: ${fetchResponse.status}, Body: ${errorBody}`);
      return NextResponse.json({ error: `Vapi API Error: Failed to fetch assistant. Status: ${fetchResponse.status}`, details: errorBody }, { status: fetchResponse.status });
    }
    const currentAssistant = await fetchResponse.json();
    console.log(`Successfully fetched current configuration for assistant ${assistantId}.`);

    // --- 2. Prepare PATCH payload ---
    // Ensure model and messages array exist, create if necessary
    const currentModel = currentAssistant.model || { provider: 'openai', model: 'gpt-4o', messages: [] }; // Provide defaults
    const currentMessages = Array.isArray(currentModel.messages) ? currentModel.messages : [];

    let systemPromptFound = false;
    const updatedMessages = currentMessages.map((msg: VapiMessage) => {
      if (msg.role === 'system') {
        systemPromptFound = true;
        // Update the content of the existing system prompt
        return { ...msg, content: newPrompt };
      }
      return msg; // Keep other messages as they are
    });

    // If no system prompt was found, add a new one
    if (!systemPromptFound) {
      updatedMessages.unshift({ role: 'system', content: newPrompt }); // Add to the beginning
    }

    const updatePayload = {
      model: {
        ...currentModel, // Keep other model settings (provider, model name, tools, etc.)
        messages: updatedMessages, // Set the updated messages array
      },
      // Include other top-level fields from currentAssistant if you want to ensure they aren't reset
      // Example: name: currentAssistant.name, voice: currentAssistant.voice, etc.
      // However, PATCH should ideally only update the specified 'model' object here.
    };

    console.log(`Updating assistant ${assistantId} with new system prompt...`);

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
    console.error('Error in /api/update-assistant-prompt:', error);
    const message = error instanceof Error ? error.message : 'Unknown error during prompt update';
    return NextResponse.json({ error: 'Internal Server Error', details: message }, { status: 500 });
  }
} 