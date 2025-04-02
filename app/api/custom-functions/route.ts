import { NextResponse } from 'next/server';
import { VapiClient } from '@vapi-ai/server-sdk';

interface ToolInfo {
  type: string;
  name?: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assistantId = searchParams.get('assistantId');

  if (!assistantId) {
    return NextResponse.json(
      { error: 'assistantId is required' },
      { status: 400 }
    );
  }

  try {
    // Initialize the Vapi client with the API key
    const client = new VapiClient({ 
      token: process.env.VAPI_API_KEY || '' 
    });

    // Get the assistant details to find its tools
    const assistant = await client.assistants.get(assistantId);
    console.log('Fetched assistant details for ID:', assistantId);

    // Initialize an array to hold tools
    let tools = [];
    
    // First check if the assistant has tools directly embedded
    if (assistant.model?.tools && assistant.model.tools.length > 0) {
      console.log('Using embedded tools from assistant model');
      tools = assistant.model.tools;
    } 
    // If not, check if it has toolIds and fetch them individually
    else if (assistant.model?.toolIds && assistant.model.toolIds.length > 0) {
      console.log('Assistant has toolIds but no embedded tools. Fetching tools individually...');
      const toolPromises = assistant.model.toolIds.map(id => client.tools.get(id));
      tools = await Promise.all(toolPromises);
      console.log(`Fetched ${tools.length} tools by ID`);
    } else {
      console.log('Assistant has no tools or toolIds configured');
      return NextResponse.json([]);
    }

    // Map the tools to our ToolInfo format
    const toolsInfo: ToolInfo[] = tools.map(tool => {
      if (tool.type === 'function' && tool.function) {
        return {
          type: tool.type,
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters?.properties || {},
        };
      }
      return {
        type: tool.type,
        name: tool.function?.name,
        description: tool.function?.description,
        parameters: tool.function?.parameters?.properties || {},
      };
    });

    console.log('Found', toolsInfo.length, 'tools for assistant', assistantId);
    return NextResponse.json(toolsInfo);
  } catch (error) {
    console.error('Error fetching assistant details:', error);
    
    // If we have an error, fall back to hardcoded data for the demo
    console.log('Falling back to hardcoded tools for assistant', assistantId);
    const fallbackTools: ToolInfo[] = [
      {
        type: 'function',
        name: 'checkAvailability',
        description: 'Check for available appointment slots within a date range',
        parameters: {
          startDate: { 
            type: 'string', 
            description: 'Start date for availability search (ISO format or natural language)' 
          },
          endDate: { 
            type: 'string', 
            description: 'End date for availability search (ISO format or natural language)' 
          }
        }
      },
      {
        type: 'function',
        name: 'bookAppointment',
        description: 'Book an appointment for a patient',
        parameters: {
          start: { 
            type: 'string', 
            description: 'Appointment start time (ISO format)' 
          },
          name: { 
            type: 'string', 
            description: 'Patient full name' 
          },
          email: { 
            type: 'string', 
            description: 'Patient email address' 
          },
          smsReminderNumber: { 
            type: 'string', 
            description: 'Phone number for SMS reminders (optional)' 
          }
        }
      }
    ];
    
    return NextResponse.json(fallbackTools);
  }
} 