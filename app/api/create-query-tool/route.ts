import { NextResponse } from 'next/server';

const VAPI_API_KEY = process.env.VAPI_API_KEY;

export async function POST(request: Request) {
  if (!VAPI_API_KEY) {
    console.error('VAPI_API_KEY is not set');
    return NextResponse.json({ error: 'Server configuration error: API key missing' }, { status: 500 });
  }

  try {
    const { fileIds, toolName, kbName, kbDescription } = await request.json();

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: 'At least one fileId is required' }, { status: 400 });
    }
    if (!toolName || typeof toolName !== 'string') {
        return NextResponse.json({ error: 'toolName is required' }, { status: 400 });
    }
     if (!kbName || typeof kbName !== 'string') {
        return NextResponse.json({ error: 'kbName is required' }, { status: 400 });
    }
     if (!kbDescription || typeof kbDescription !== 'string') {
        return NextResponse.json({ error: 'kbDescription is required' }, { status: 400 });
    }

    console.log(`Creating query tool "${toolName}" with KB "${kbName}" using file IDs: ${fileIds.join(', ')}`);

    const toolPayload = {
      type: "query",
      // The 'function' object defines how the assistant *calls* the tool.
      // The 'name' here is what the assistant uses internally.
      function: {
        name: toolName, // e.g., "search_dynamic_knowledge"
        description: `Use this tool to answer questions based on the dynamically uploaded content about: ${kbDescription}`, // Help LLM know when to use it
        parameters: { // Define parameters the LLM needs to extract from the user query
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The specific question or topic the user is asking about related to the knowledge base."
            }
          },
          required: ["query"]
        }
      },
      // The 'knowledgeBases' array defines the actual data sources for the tool.
      knowledgeBases: [
        {
          provider: "google", // Currently the only supported provider for Query Tool KB
          model: "gemini-1.5-flash", // Default model for Google KB
          name: kbName, // An internal name for this specific KB source
          description: kbDescription, // Helps the assistant choose *this specific KB* if multiple are present
          fileIds: fileIds // The IDs of the files uploaded earlier
        }
        // You could add more knowledgeBase objects here if needed
      ]
      // Optional: Add server config if you want Vapi to call *your* server
      // when this tool is invoked, instead of Vapi handling the query directly.
      // server: { url: "YOUR_SERVER_ENDPOINT_FOR_QUERY_TOOL" }
    };

    const response = await fetch('https://api.vapi.ai/tool', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toolPayload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`Vapi API Error (Create Tool): ${response.status}`, responseData);
      return NextResponse.json({ error: `Failed to create query tool: ${responseData.message || response.statusText}` }, { status: response.status });
    }

    console.log(`Successfully created query tool "${toolName}". Tool ID: ${responseData.id}`);
    return NextResponse.json({ toolId: responseData.id });

  } catch (error) {
    console.error('Error in /api/create-query-tool:', error);
    const message = error instanceof Error ? error.message : 'Unknown error during tool creation';
    return NextResponse.json({ error: 'Internal Server Error', details: message }, { status: 500 });
  }
} 