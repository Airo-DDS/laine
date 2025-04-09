import { NextResponse } from 'next/server';

const VAPI_API_KEY = process.env.VAPI_API_KEY;

export async function GET(request: Request) {
  if (!VAPI_API_KEY) {
    console.error('API Key missing in server environment.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  try {
    // Get the assistant ID from the query parameters
    const url = new URL(request.url);
    const assistantId = url.searchParams.get('id');

    if (!assistantId) {
      return NextResponse.json({ error: 'assistantId is required.' }, { status: 400 });
    }

    console.log(`API: Fetching config for assistant ID: ${assistantId}`);
    const response = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Accept': 'application/json',
      },
      cache: 'no-store', // Ensure fresh data is fetched
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`API Error (Fetch Assistant): ${response.status}`, data);
      return NextResponse.json({ error: `Failed to fetch assistant: ${data.message || response.statusText}` }, { status: response.status });
    }

    console.log("API: Successfully fetched assistant config.");
    return NextResponse.json(data);

  } catch (error) {
    console.error('API Error in /api/get-assistant-config:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal Server Error', details: message }, { status: 500 });
  }
} 