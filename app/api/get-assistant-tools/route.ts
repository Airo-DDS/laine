import { NextResponse } from 'next/server';
import { VapiClient } from '@vapi-ai/server-sdk';

const VAPI_API_KEY = process.env.VAPI_API_KEY;

// Simplified interface for Vapi Tool structure
interface VapiTool {
  id?: string;
  type: string;
  function?: {
    name?: string;
    description?: string;
    // Add other function properties if needed
    parameters?: Record<string, unknown>;
  };
  // Some tool types might have description at the root level
  description?: string;
  destinations?: string[];
  knowledgeBases?: string[];
  // Add other potential root-level tool properties if needed
}

export async function GET(request: Request) {
  // --- Basic Setup & Validation ---
  if (!VAPI_API_KEY) {
    console.error("VAPI_API_KEY is not set in environment variables.");
    return NextResponse.json({ error: 'Server configuration error: API key missing' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const assistantId = searchParams.get('id');

  if (!assistantId) {
    console.error("Request missing assistantId query parameter.");
    return NextResponse.json({ error: 'assistantId is required' }, { status: 400 });
  }

  console.log(`[get-assistant-tools] Received request for assistantId: ${assistantId}`);

  try {
    // Initialize Vapi Client
    const vapi = new VapiClient({ token: VAPI_API_KEY });

    // --- Fetch Assistant Configuration ---
    console.log(`[get-assistant-tools] Fetching assistant configuration for ID: ${assistantId}`);
    const assistant = await vapi.assistants.get(assistantId);

    if (!assistant || !assistant.model) {
      console.log(`[get-assistant-tools] Assistant ${assistantId} not found or has no model configuration.`);
      // Return empty list if assistant or model config is missing
      return NextResponse.json({ tools: [] });
    }
    console.log(`[get-assistant-tools] Successfully fetched assistant configuration for ${assistantId}.`);

    const toolList: VapiTool[] = [];

    // --- Process Transient Tools (assistant.model.tools) ---
    if (Array.isArray(assistant.model.tools)) {
      console.log(`[get-assistant-tools] Processing ${assistant.model.tools.length} transient tools.`);
      for (const tool of assistant.model.tools as VapiTool[]) { // Cast to your defined interface
        // Add the full tool object
        toolList.push({
          ...tool,
          // Add a generated name/description if not already present
          function: {
            ...tool.function,
            name: tool.function?.name || tool.type,
            description: tool.function?.description || tool.description || `A ${tool.type} tool.`
          }
        });
      }
    } else {
      console.log('[get-assistant-tools] No transient tools found in assistant.model.tools.');
    }

    // --- Process Tools by ID (assistant.model.toolIds) ---
    if (Array.isArray(assistant.model.toolIds) && assistant.model.toolIds.length > 0) {
      console.log(`[get-assistant-tools] Processing ${assistant.model.toolIds.length} tool IDs: ${assistant.model.toolIds.join(', ')}.`);
      const toolDetailPromises = assistant.model.toolIds.map(toolId =>
        vapi.tools.get(toolId)
          .then(toolData => {
            if (toolData) {
              console.log(`[get-assistant-tools] Successfully fetched details for tool ID: ${toolId}`);
              // Return the full tool data
              return toolData as unknown as VapiTool;
            }
            console.warn(`[get-assistant-tools] Tool data for ID ${toolId} was unexpectedly null or undefined.`);
            return null; // Explicitly return null if data is missing
          })
          .catch(err => {
            console.error(`[get-assistant-tools] Failed to fetch tool ${toolId}:`, err instanceof Error ? err.message : err);
            return null; // Return null on fetch error to not break Promise.all
          })
      );

      const toolDetails = await Promise.all(toolDetailPromises);

      // Add successfully fetched tools to the list
      for (const tool of toolDetails) {
        if (tool) {
          toolList.push(tool);
        }
      }
      console.log('[get-assistant-tools] Finished processing tool IDs.');
    } else {
      console.log('[get-assistant-tools] No tool IDs found in assistant.model.toolIds.');
    }

    // --- Deduplicate and Return ---
    // Use tool ID for uniqueness if available, otherwise use type + function name as a composite key
    const uniqueToolMap = new Map<string, VapiTool>();
    for (const tool of toolList) {
      const key = tool.id || `${tool.function?.name || ''}-${tool.type}`; // Use ID if present, else composite key
      if (!uniqueToolMap.has(key)) {
        uniqueToolMap.set(key, tool);
      }
    }

    const uniqueToolList = Array.from(uniqueToolMap.values());
    console.log(`[get-assistant-tools] Returning ${uniqueToolList.length} unique tools for assistant ${assistantId}.`);

    return NextResponse.json({ tools: uniqueToolList });

  } catch (error) {
    console.error('[get-assistant-tools] Unexpected error fetching assistant tools:', error);
    const message = error instanceof Error ? error.message : 'Unknown server error occurred';
    return NextResponse.json({ error: 'Internal Server Error', details: message }, { status: 500 });
  }
} 