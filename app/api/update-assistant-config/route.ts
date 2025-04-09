import { NextResponse } from 'next/server';

const VAPI_API_KEY = process.env.VAPI_API_KEY;

export async function POST(request: Request) {
  if (!VAPI_API_KEY) {
    console.error('API Key missing in server environment.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  try {
    const { assistantId, updatePayload } = await request.json();

    if (!assistantId || typeof assistantId !== 'string') {
      return NextResponse.json({ error: 'assistantId is required.' }, { status: 400 });
    }
    if (!updatePayload || typeof updatePayload !== 'object') {
      return NextResponse.json({ error: 'updatePayload object is required.' }, { status: 400 });
    }

    console.log(`API: Updating config for assistant ${assistantId}...`);

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
      console.error(`API Error (Update Assistant): ${updateResponse.status}`, responseData);
      return NextResponse.json({ error: `Failed to update assistant: ${responseData.message || updateResponse.statusText}` }, { status: updateResponse.status });
    }

    console.log(`API: Successfully updated assistant ${assistantId}.`);
    return NextResponse.json({ success: true, assistant: responseData });

  } catch (error) {
    console.error('API Error in /api/update-assistant-config:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal Server Error', details: message }, { status: 500 });
  }
} 