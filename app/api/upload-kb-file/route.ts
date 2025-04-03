import { NextResponse } from 'next/server';

const VAPI_API_KEY = process.env.VAPI_API_KEY;

export async function POST(request: Request) {
  if (!VAPI_API_KEY) {
    console.error('VAPI_API_KEY is not set');
    return NextResponse.json({ error: 'Server configuration error: API key missing' }, { status: 500 });
  }

  try {
    const { content, filename } = await request.json();

    if (!content || typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json({ error: 'File content cannot be empty' }, { status: 400 });
    }
    if (!filename || typeof filename !== 'string') {
        return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    console.log(`Received request to upload file: ${filename}`);

    // Create a Blob from the text content
    const blob = new Blob([content], { type: 'text/plain' });

    // Create FormData to send the Blob as a file
    const formData = new FormData();
    formData.append('file', blob, filename); // Vapi expects the field name 'file'

    console.log(`Uploading ${filename} to Vapi...`);

    const response = await fetch('https://api.vapi.ai/file', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        // Content-Type is set automatically by fetch when using FormData
      },
      body: formData,
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`Vapi API Error (Upload File ${filename}): ${response.status}`, responseData);
      return NextResponse.json({ error: `Failed to upload file to Vapi: ${responseData.message || response.statusText}` }, { status: response.status });
    }

    console.log(`Successfully uploaded ${filename}. File ID: ${responseData.id}`);
    return NextResponse.json({ fileId: responseData.id });

  } catch (error) {
    console.error('Error in /api/upload-kb-file:', error);
    const message = error instanceof Error ? error.message : 'Unknown error during file upload';
    return NextResponse.json({ error: 'Internal Server Error', details: message }, { status: 500 });
  }
} 