import { NextResponse } from 'next/server';
import { VapiClient } from '@vapi-ai/server-sdk';

const VAPI_API_KEY = process.env.VAPI_API_KEY;

interface ToolInfo {
  id?: string; // ID might not exist for transient tools
  name: string;
  description?: string;
  type: string; // e.g., 'function', 'query', 'transferCall'
}

// Define interface for tool object returned by Vapi API
interface VapiTool {
  id?: string;
  type: string;
  function?: {
    name?: string;
    description?: string;
  };
  description?: string;
}

export async function GET(request: Request) {
  if (!VAPI_API_KEY) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const assistantId = searchParams.get('id');

  if (!assistantId) {
    return NextResponse.json({ error: 'assistantId is required' }, { status: 400 });
  }

  try {
    const vapi = new VapiClient({ token: VAPI_API_KEY });

    // 1. Fetch the assistant configuration
    const assistant = await vapi.assistants.get(assistantId);
    if (!assistant || !assistant.model) {
      return NextResponse.json({ tools: [] }); // No model or assistant found
    }

    const toolList: ToolInfo[] = [];

    // 2. Process transient tools defined directly in the assistant config
    if (Array.isArray(assistant.model.tools)) {
      for (const tool of assistant.model.tools as VapiTool[]) {
        // Extract common properties
        const name = tool.function?.name || tool.type; // Use function name or type as fallback
        const description = tool.function?.description || tool.description || `A ${tool.type} tool.`;
        toolList.push({ name, description, type: tool.type });
      }
    }

    // 3. Process toolIds (references to saved tools)
    if (Array.isArray(assistant.model.toolIds)) {
      const toolDetailPromises = assistant.model.toolIds.map(toolId =>
        vapi.tools.get(toolId).catch(err => {
          console.error(`Failed to fetch tool ${toolId}:`, err);
          return null; // Return null if fetching a specific tool fails
        })
      );
      const toolDetails = await Promise.all(toolDetailPromises);

      for (const tool of toolDetails) {
        if (tool) {
          const name = tool.function?.name || tool.type;
          // Use optional chaining for descriptions
          const toolDescription = tool.function?.description || 
            (tool as unknown as { description?: string })?.description || 
            `A ${tool.type} tool.`;
          toolList.push({ id: tool.id, name, description: toolDescription, type: tool.type });
        }
      }
    }

    // Remove duplicates if a tool is both transient and referenced by ID (unlikely but possible)
    const uniqueToolList = Array.from(new Map(toolList.map(tool => [tool.name, tool])).values());

    return NextResponse.json({ tools: uniqueToolList });

  } catch (error) {
    console.error('Error fetching assistant tools:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal Server Error', details: message }, { status: 500 });
  }
} 