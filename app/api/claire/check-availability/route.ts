import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Simple logging utility
function log(message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

// Define CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// More specific types for arguments
type FunctionArguments = {
  startDate?: string;
  [key: string]: unknown;
};

// Type for possible request body formats
type RequestBody = {
  message?: {
    toolCalls?: Array<{
      id: string;
      function?: {
        name?: string;
        arguments?: string | Record<string, unknown>;
      };
    }>;
    toolCallList?: Array<{
      id: string;
      function?: {
        name?: string;
        arguments?: string | Record<string, unknown>;
      };
    }>;
  };
  tool_call_id?: string;
  parameters?: { startDate?: string };
  toolCallId?: string;
  arguments?: string | Record<string, unknown>;
  toolCalls?: Array<{
    id: string;
    function?: {
      name?: string;
      arguments?: string | Record<string, unknown>;
    };
  }>;
};

export async function POST(request: Request) {
  log('Received check-availability request');
  
  // Handle preflight request
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { headers: corsHeaders });
  }

  let reqBody: RequestBody = {}; // Define here to access in catch block
  
  try {
    reqBody = await request.json();
    log('Request body', reqBody);

    // Extract toolCallId and parameters from different possible structures
    let toolCallId = '';
    let startDate = '';
    
    // Handle nested message format from VAPI
    if (reqBody.message?.toolCalls && reqBody.message.toolCalls.length > 0) {
      const toolCall = reqBody.message.toolCalls[0];
      toolCallId = toolCall.id;
      
      if (typeof toolCall.function?.arguments === 'string') {
        try {
          const args = JSON.parse(toolCall.function.arguments) as FunctionArguments;
          startDate = args.startDate || '';
        } catch (e) {
          log('Error parsing tool call arguments', { error: e });
        }
      } else if (toolCall.function?.arguments) {
        const args = toolCall.function.arguments as Record<string, unknown>;
        startDate = (args.startDate as string) || '';
      }
    }
    // Handle nested message with toolCallList format
    else if (reqBody.message?.toolCallList && reqBody.message.toolCallList.length > 0) {
      const toolCall = reqBody.message.toolCallList[0];
      toolCallId = toolCall.id;
      
      if (typeof toolCall.function?.arguments === 'string') {
        try {
          const args = JSON.parse(toolCall.function.arguments) as FunctionArguments;
          startDate = args.startDate || '';
        } catch (e) {
          log('Error parsing tool call arguments', { error: e });
        }
      } else if (toolCall.function?.arguments) {
        const args = toolCall.function.arguments as Record<string, unknown>;
        startDate = (args.startDate as string) || '';
      }
    }
    // Handle direct VAPI format
    else if (reqBody.tool_call_id) {
      toolCallId = reqBody.tool_call_id;
      startDate = reqBody.parameters?.startDate || '';
    } 
    // Handle OpenAI format (from VAPI proxy)
    else if (reqBody.toolCallId) {
      toolCallId = reqBody.toolCallId;
      
      if (typeof reqBody.arguments === 'string') {
        try {
          const args = JSON.parse(reqBody.arguments) as FunctionArguments;
          startDate = args.startDate || '';
        } catch (e) {
          log('Error parsing arguments', { error: e });
        }
      } else if (reqBody.arguments) {
        const args = reqBody.arguments as Record<string, unknown>;
        startDate = (args.startDate as string) || '';
      }
    } 
    // Handle array format from VAPI
    else if (Array.isArray(reqBody.toolCalls) && reqBody.toolCalls.length > 0) {
      const toolCall = reqBody.toolCalls[0];
      toolCallId = toolCall.id;
      
      if (typeof toolCall.function?.arguments === 'string') {
        try {
          const args = JSON.parse(toolCall.function.arguments) as FunctionArguments;
          startDate = args.startDate || '';
        } catch (e) {
          log('Error parsing tool call arguments', { error: e });
        }
      } else if (toolCall.function?.arguments) {
        const args = toolCall.function.arguments as Record<string, unknown>;
        startDate = (args.startDate as string) || '';
      }
    }
    
    // For debugging, log the extracted parameters
    log('Extracted parameters', { toolCallId, startDate });
    
    if (!startDate) {
      log('No start date provided in request');
      return NextResponse.json(
        { 
          tool_call_id: toolCallId,
          status: 'error',
          message: 'Start date is required'
        }, 
        { 
          status: 400,
          headers: corsHeaders 
        }
      );
    }

    log('Checking availability for date', { startDate });
    
    // Fix date for demo if in the past (handle 2024 dates)
    const requestedTime = new Date(startDate);
    const currentYear = new Date().getFullYear();
    
    // If date is in the past because the year is 2024, update it to current year + 1
    if (requestedTime < new Date() && requestedTime.getFullYear() < currentYear) {
      requestedTime.setFullYear(currentYear + 1);
      log('Updated date to future year for demo purposes', { 
        originalDate: startDate,
        updatedDate: requestedTime.toISOString()
      });
    }
    
    // Query appointments from database
    const appointments = await prisma.appointment.findMany({
      select: {
        id: true,
        date: true,
        patient: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });
    
    log('Retrieved appointments', { count: appointments.length });
    
    // Format the date for display
    const formattedDate = requestedTime.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      timeZone: 'America/Chicago',
    });
    
    // Find if there's a conflicting appointment
    const conflictingAppointment = appointments.find(appointment => {
      const appointmentTime = new Date(appointment.date);
      const timeDiffMs = Math.abs(appointmentTime.getTime() - requestedTime.getTime());
      // Consider appointments within 30 minutes as conflicting
      return timeDiffMs < 30 * 60 * 1000;
    });
    
    let message = '';
    if (conflictingAppointment) {
      message = `I'm sorry, but ${formattedDate} is not available. We already have an appointment at that time. Would you like to try another time? I can offer tomorrow at 10:00 AM, 2:00 PM, or 4:30 PM.`;
    } else {
      message = `Yes, ${formattedDate} is available! Would you like me to book this appointment for you?`;
    }
    
    // Format response according to Vapi docs
    const response = {
      tool_call_id: toolCallId,
      status: 'success',
      message,
      // Also include results array format as per docs
      results: [{
        toolCallId: toolCallId,
        result: message
      }]
    };
    
    // Return the result
    log('Sending response', { available: !conflictingAppointment, message });
    return NextResponse.json(
      response,
      { headers: corsHeaders }
    );
    
  } catch (error) {
    // Log the error and return error response
    log('Error checking availability', error as Record<string, unknown>);
    
    const toolCallId = reqBody?.tool_call_id || '';
    const errorMessage = 'Failed to check availability. Please try again.';
    
    return NextResponse.json(
      {
        tool_call_id: toolCallId,
        status: 'error',
        message: errorMessage,
        // Also include results array format as per docs
        results: [{
          toolCallId: toolCallId,
          result: errorMessage
        }]
      },
      { 
        status: 500,
        headers: corsHeaders 
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: corsHeaders,
  });
} 