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

// Type for possible request body formats
type RequestBody = {
  tool_call_id?: string;
  parameters?: { startDate?: string };
  toolCallId?: string;
  arguments?: string;
  toolCalls?: Array<{
    id: string;
    function?: {
      arguments?: string;
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
    
    // Handle direct VAPI format
    if (reqBody.tool_call_id) {
      toolCallId = reqBody.tool_call_id;
      startDate = reqBody.parameters?.startDate || '';
    } 
    // Handle OpenAI format (from VAPI proxy)
    else if (reqBody.toolCallId) {
      toolCallId = reqBody.toolCallId;
      startDate = reqBody.arguments ? JSON.parse(reqBody.arguments).startDate : '';
    } 
    // Handle array format from VAPI
    else if (Array.isArray(reqBody.toolCalls) && reqBody.toolCalls.length > 0) {
      const toolCall = reqBody.toolCalls[0];
      toolCallId = toolCall.id;
      startDate = toolCall.function?.arguments ? 
        JSON.parse(toolCall.function.arguments).startDate : '';
    }
    
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
    const formattedDate = new Date(startDate).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      timeZone: 'America/Chicago',
    });
    
    // Check if the time is available
    const requestedTime = new Date(startDate);
    
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
    
    // Return the result
    log('Sending response', { available: !conflictingAppointment });
    return NextResponse.json(
      {
        tool_call_id: toolCallId,
        status: 'success',
        message
      },
      { headers: corsHeaders }
    );
    
  } catch (error) {
    // Log the error and return error response
    log('Error checking availability', error as Record<string, unknown>);
    
    return NextResponse.json(
      {
        tool_call_id: reqBody?.tool_call_id || '',
        status: 'error',
        message: 'Failed to check availability. Please try again.'
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