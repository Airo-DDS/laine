import { NextResponse } from 'next/server';
import { VapiClient } from '@vapi-ai/server-sdk';

// Interface for the data we want to send to the frontend
interface CallLogInfo {
  id: string; // Use id instead of callId for consistency
  createdAt: string; // ISO string
  endedAt: string | null; // ISO string or null
  durationSeconds: number | null; // Calculated duration
  status: string; // Use string for status
  endedReason: string | null;
  transcript: string | null;
  summary: string | null;
  structuredData: Record<string, unknown> | null;
  recordingUrl: string | null; // Added recording URL
}

// Logging Utility
function log(message: string, data?: unknown) {
    console.log(`[${new Date().toISOString()}] [api/call-logs] ${message}`);
    if (data !== undefined) {
        console.log(JSON.stringify(data, null, 2));
    }
}

export async function GET(request: Request) {
    log("GET request received");
    const { searchParams } = new URL(request.url);
    // Keep assistantId filtering optional for now, can fetch all org logs
    const assistantId = searchParams.get('assistantId');
    // Add pagination/filtering params later if needed
    const limit = Number.parseInt(searchParams.get('limit') || '50', 10);

    const VAPI_API_KEY = process.env.VAPI_API_KEY;
    if (!VAPI_API_KEY) {
        log("VAPI_API_KEY is not set");
        return NextResponse.json({ error: 'Server configuration error: API key missing' }, { status: 500 });
    }

    try {
        const client = new VapiClient({ token: VAPI_API_KEY });

        log(`Fetching calls ${assistantId ? `for assistant ${assistantId}` : 'for organization'} with limit ${limit}`);
        // Prepare list options
        const listOptions: { assistantId?: string; limit: number } = { limit };
        if (assistantId) {
            listOptions.assistantId = assistantId;
        }

        // Get the list of basic call info
        const callsList = await client.calls.list(listOptions);
        log(`Found ${callsList.length} calls in list.`);

        // Fetch detailed information concurrently
        const detailPromises = callsList.map(async (basicCall) => {
            if (!basicCall.id) return null;
            try {
                const detailedCall = await client.calls.get(basicCall.id);
                log(`Fetched details for call: ${detailedCall.id}`);

                // Calculate duration
                let durationSeconds: number | null = null;
                if (detailedCall.startedAt && detailedCall.endedAt) {
                    durationSeconds = Math.round(
                        (new Date(detailedCall.endedAt).getTime() - new Date(detailedCall.startedAt).getTime()) / 1000
                    );
                }

                // Map to our frontend interface
                const callLogInfo: CallLogInfo = {
                    id: detailedCall.id || '',  // Ensure id is always a string
                    createdAt: detailedCall.createdAt as string || new Date().toISOString(), // Fallback to current time
                    endedAt: detailedCall.endedAt as string | null,
                    durationSeconds: durationSeconds,
                    status: detailedCall.status || 'unknown',
                    endedReason: detailedCall.endedReason || null,
                    transcript: detailedCall.artifact?.transcript || null,
                    summary: detailedCall.analysis?.summary || null,
                    structuredData: detailedCall.analysis?.structuredData || null,
                    recordingUrl: detailedCall.artifact?.recordingUrl || null, // Get recording URL
                };
                return callLogInfo;
            } catch (callDetailError) {
                log(`Error fetching details for call ${basicCall.id}:`, callDetailError);
                return null; // Skip this call if details fail
            }
        });

        const detailedCallsResults = await Promise.all(detailPromises);
        const successfulDetailedCalls = detailedCallsResults.filter((call): call is CallLogInfo => call !== null);

        log(`Returning ${successfulDetailedCalls.length} detailed call logs.`);
        return NextResponse.json(successfulDetailedCalls);

    } catch (error) {
        log('Error fetching call logs:', error);
        const message = error instanceof Error ? error.message : 'Failed to retrieve call logs.';
        // Don't return mock data in production, return the error
        return NextResponse.json({ error: message }, { status: 500 });
    }
} 