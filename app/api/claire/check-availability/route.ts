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

// Process date to ensure it's valid and in the future
function processRequestDate(dateString: string): Date {
  const currentTime = new Date();
  const currentYear = currentTime.getFullYear();
  let requestedTime: Date;
  
  // Create a date object from the string
  const parsedDate = new Date(dateString);
  
  // Check if date string is a valid ISO format date
  if (!Number.isNaN(parsedDate.getTime())) {
    requestedTime = parsedDate;
    
    // If date is in the past, try to fix the year
    if (requestedTime < currentTime) {
      // First try current year
      requestedTime.setFullYear(currentYear);
      
      // If still in the past, try next year
      if (requestedTime < currentTime) {
        requestedTime.setFullYear(currentYear + 1);
      }
      
      log('Updated date year to ensure it is in the future', {
        originalDate: dateString,
        updatedDate: requestedTime.toISOString()
      });
    }
    
    return requestedTime;
  }
  
  // If we get here, the date string was not valid ISO format
  // For demo purposes, return the current date plus 1 day at 3:00 PM
  log('Invalid date format, using tomorrow at 3PM as fallback', { 
    originalDate: dateString
  });
  
  const fallbackDate = new Date(currentTime);
  fallbackDate.setDate(fallbackDate.getDate() + 1);
  fallbackDate.setHours(15, 0, 0, 0); // 3:00 PM
  return fallbackDate;
}

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
          results: [{
            toolCallId: toolCallId,
            result: 'Start date is required'
          }]
        }, 
        { 
          status: 400,
          headers: corsHeaders 
        }
      );
    }

    log('Checking availability for date', { startDate });
    
    // Process the date to ensure it's valid and in the future
    const requestedTime = processRequestDate(startDate);
    
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
    
    // Format the requested time for display
    const formattedTime = requestedTime.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
    
    // Find if there's a conflicting appointment
    const conflictingAppointment = appointments.find(appointment => {
      const appointmentTime = new Date(appointment.date);
      const timeDiffMs = Math.abs(appointmentTime.getTime() - requestedTime.getTime());
      // Consider appointments within 30 minutes as conflicting
      return timeDiffMs < 30 * 60 * 1000;
    });
    
    // Generate alternative times for unavailable slots
    function getAlternativeTimes(baseTime: Date): string[] {
      const alternatives = [];
      
      // Next day, same time
      const nextDay = new Date(baseTime);
      nextDay.setDate(nextDay.getDate() + 1);
      alternatives.push(nextDay.toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }));
      
      // Same day, 2 hours later
      const laterTime = new Date(baseTime);
      laterTime.setHours(laterTime.getHours() + 2);
      alternatives.push(laterTime.toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }));
      
      return alternatives;
    }
    
    let message = '';
    if (conflictingAppointment) {
      const alternatives = getAlternativeTimes(requestedTime);
      message = `No ${formattedTime} is not available, here are ${alternatives[0]} and ${alternatives[1]}`;
    } else {
      message = `Yes ${formattedTime} is available`;
    }
    
    // Format response according to Vapi docs - simplified to exactly match the docs
    const response = {
      results: [{
        toolCallId: toolCallId,
        result: message
      }]
    };
    
    // Return the result
    log('Sending response', response);
    return NextResponse.json(
      response,
      { headers: corsHeaders }
    );
    
  } catch (error) {
    // Log the error and return error response
    log('Error checking availability', error as Record<string, unknown>);
    
    const toolCallId = reqBody?.tool_call_id || '';
    const errorMessage = 'error';
    
    return NextResponse.json(
      {
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