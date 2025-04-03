import { NextResponse } from 'next/server';

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;

// Define interface for message object
interface VapiMessage {
  role: string;
  content: string;
}

export async function GET() {
  if (!VAPI_API_KEY || !VAPI_ASSISTANT_ID) {
    console.error('API Key or Assistant ID is missing in server environment variables.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  try {
    console.log(`Fetching assistant configuration for ID: ${VAPI_ASSISTANT_ID}`);
    const response = await fetch(`https://api.vapi.ai/assistant/${VAPI_ASSISTANT_ID}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`Vapi API Error (Fetch Assistant): ${response.status}`, data);
      return NextResponse.json({ error: `Failed to fetch assistant: ${data.message || response.statusText}` }, { status: response.status });
    }

    // Find the system prompt within the model messages
    let systemPromptContent = '';
    if (data.model && Array.isArray(data.model.messages)) {
      const systemMessage = data.model.messages.find((msg: VapiMessage) => msg.role === 'system');
      if (systemMessage) {
        systemPromptContent = systemMessage.content || '';
      }
    }

    console.log("Successfully fetched system prompt.");
    return NextResponse.json({ prompt: systemPromptContent });

  } catch (error) {
    console.error('Error fetching assistant prompt:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: 'Internal Server Error', details: message }, { status: 500 });
  }
} 