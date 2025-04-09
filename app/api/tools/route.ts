import { NextResponse } from 'next/server';
import { VapiClient } from '@vapi-ai/server-sdk';
import type { ToolInfo } from '@/app/types/vapi';

const VAPI_API_KEY = process.env.VAPI_API_KEY;

export async function GET() {
  // Basic validation check
  if (!VAPI_API_KEY) {
    console.error("VAPI_API_KEY is not set in environment variables.");
    return NextResponse.json({ error: 'Server configuration error: API key missing' }, { status: 500 });
  }

  try {
    // Initialize Vapi Client
    const vapi = new VapiClient({ token: VAPI_API_KEY });

    // Fetch all tools for the organization
    console.log("[tools] Fetching all tools for the organization");
    const tools = await vapi.tools.list();

    if (!tools || !Array.isArray(tools)) {
      console.log("[tools] No tools found or invalid response format");
      // Return empty array if no tools found
      return NextResponse.json({ tools: [] });
    }

    // Transform tools to consistent format
    const formattedTools: ToolInfo[] = tools.map(tool => {
      // Cast the tool to appropriate shape
      const typedTool = tool as unknown as Record<string, unknown>;

      return {
        id: typedTool.id as string | undefined,
        name: ((typedTool.function as Record<string, unknown> | undefined)?.name as string) || typedTool.type as string,
        description: ((typedTool.function as Record<string, unknown> | undefined)?.description as string) || 
                     (typedTool.description as string) || 
                     `A ${typedTool.type as string} tool.`,
        type: typedTool.type as string,
        function: typedTool.function as {
          name?: string;
          description?: string;
          parameters?: Record<string, unknown>;
        } | undefined,
        destinations: typedTool.destinations as string[] | undefined,
        knowledgeBases: typedTool.knowledgeBases as string[] | undefined
      };
    });

    console.log(`[tools] Successfully fetched ${formattedTools.length} tools`);
    return NextResponse.json({ tools: formattedTools });
  } catch (error) {
    // Log and return error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("[tools] Error fetching tools:", errorMessage);
    return NextResponse.json({ error: 'Failed to fetch tools' }, { status: 500 });
  }
} 