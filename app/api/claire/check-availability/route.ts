import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Enhanced logging function
function logDebug(message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data !== undefined) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// VAPI Tool Call Interface - Updated to match the new format
interface VapiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    parameters?: {
      startDate?: string;
      endDate?: string;
    };
    arguments?: string | { // Allow both string and object format
      startDate?: string;
      endDate?: string;
    };
  };
  messages?: Array<{
    type: string;
    content: string;
  }>;
}

// New VAPI Message structure that matches the incoming payload
interface VapiMessage {
  message?: {
    timestamp?: number;
    type?: string;
    toolCalls?: VapiToolCall[];
    toolCallList?: VapiToolCall[];
    toolWithToolCallList?: Array<{
      type?: string;
      function?: Record<string, unknown>;
      async?: boolean;
      server?: Record<string, unknown>;
      messages?: unknown[];
      toolCall?: VapiToolCall;
    }>;
    artifact?: Record<string, unknown>;
    call?: Record<string, unknown>;
    assistant?: Record<string, unknown>;
  };
}

// Define standard appointment slots (30 minutes each, from 9am to 5pm)
const APPOINTMENT_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', 
  '15:00', '15:30', '16:00', '16:30', '17:00'
];

// Check if a date is a business day (Monday-Friday)
function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 0 = Sunday, 6 = Saturday
}

// Check if a date is in the past (with some buffer for processing)
function isDateInPast(date: Date): boolean {
  const now = new Date();
  // Add 15 minutes buffer for processing time differences
  now.setMinutes(now.getMinutes() - 15);
  return date < now;
}

// Convert UTC date to Pacific Time (dental practice timezone)
function convertToPacificTime(utcDate: Date): Date {
  // Create formatter for Pacific Time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', 
    month: 'numeric', 
    day: 'numeric',
    hour: 'numeric', 
    minute: 'numeric', 
    second: 'numeric',
    hour12: false
  });
  
  // Format the date in Pacific Time
  const pacificTimeStr = formatter.format(utcDate);
  return new Date(pacificTimeStr);
}

// Format date for response
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

// Generate all possible slots for a date range
async function findAvailableSlots(startDate: Date, endDate: Date): Promise<string[]> {
  logDebug('Finding available slots', { 
    startDate: startDate.toISOString(), 
    endDate: endDate.toISOString(),
    startDateLocal: startDate.toString(),
    endDateLocal: endDate.toString()
  });

  // Ensure we're working with dates with zeroed-out time components
  const startDateCopy = new Date(startDate);
  startDateCopy.setHours(0, 0, 0, 0);
  
  const endDateCopy = new Date(endDate);
  endDateCopy.setHours(23, 59, 59, 999);
  
  logDebug('Adjusted date range for full day coverage', {
    startDateCopy: startDateCopy.toISOString(),
    endDateCopy: endDateCopy.toISOString()
  });

  try {
    // Get all appointments within the date range
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        date: {
          gte: startDateCopy,
          lte: endDateCopy
        },
        status: {
          in: ['SCHEDULED', 'CONFIRMED'] // Only consider active appointments
        }
      },
      select: {
        date: true
      }
    });
    
    logDebug(`Found ${existingAppointments.length} existing appointments in range`);
    
    // Create a map of booked slots
    const bookedSlots = new Set(
      existingAppointments.map(apt => apt.date.toISOString())
    );
    
    const availableSlots: string[] = [];
    const currentDate = new Date(startDateCopy);
    
    // Loop through each day in the range
    while (currentDate <= endDateCopy) {
      // Only include business days
      if (isBusinessDay(currentDate)) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Add each time slot for the day
        for (const timeSlot of APPOINTMENT_SLOTS) {
          const slotDateTime = new Date(`${dateStr}T${timeSlot}:00`);
          
          // Skip slots in the past
          if (isDateInPast(slotDateTime)) {
            continue;
          }
          
          const slotISOString = slotDateTime.toISOString();
          
          // Check if this slot is available
          if (!bookedSlots.has(slotISOString)) {
            availableSlots.push(slotISOString);
          }
        }
      } else {
        logDebug(`Skipping non-business day: ${currentDate.toDateString()}`);
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    logDebug(`Found ${availableSlots.length} available slots`);
    return availableSlots;
  } catch (error) {
    logDebug('Error finding available slots', error);
    throw error;
  }
}

// Format the available slots into a human-readable response
function formatAvailabilityResponse(availableSlots: string[], requestedTime?: Date): string {
  if (availableSlots.length === 0) {
    return "I'm sorry, but there are no appointment slots available in the requested timeframe. Would you like to try a different date range?";
  }
  
  // Group slots by date
  const slotsByDate: Record<string, string[]> = {};
  
  // Sort slots by time
  availableSlots.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  
  // If a specific time was requested, try to find slots close to it
  let closestSlots: string[] = [];
  if (requestedTime) {
    const requestedTimeMs = requestedTime.getTime();
    // Sort by proximity to the requested time
    closestSlots = [...availableSlots].sort((a, b) => {
      const diffA = Math.abs(new Date(a).getTime() - requestedTimeMs);
      const diffB = Math.abs(new Date(b).getTime() - requestedTimeMs);
      return diffA - diffB;
    }).slice(0, 3); // Get the 3 closest times
  }
  
  for (const slot of availableSlots) {
    const date = slot.split('T')[0];
    if (!slotsByDate[date]) {
      slotsByDate[date] = [];
    }
    slotsByDate[date].push(slot);
  }
  
  // Sort dates
  const sortedDates = Object.keys(slotsByDate).sort();
  
  // Limit to first 3 days with availability
  const selectedDates = sortedDates.slice(0, 3);
  
  // Generate response text
  let response = "We have several appointment slots available. ";
  
  // If there was a specific requested time and we found close alternatives
  if (requestedTime && closestSlots.length > 0) {
    response = `I don't see availability at exactly ${requestedTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true
    })}, but I can offer you these alternative times: `;
    
    const formattedClosestTimes = closestSlots.map(slot => {
      const slotDate = new Date(slot);
      return `${formatDate(slot)} at ${slotDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })}`;
    });
    
    response += formattedClosestTimes.join(', ');
    response += '. Would any of these times work for you?';
    return response;
  }
  
  // Standard response with available slots
  selectedDates.forEach((date, dateIndex) => {
    // Format date
    const dateObj = new Date(date);
    const formattedDate = formatDate(dateObj.toISOString());
    
    response += `On ${formattedDate}, we have: `;
    
    // Limit to 3 times per day for readability
    const timesForDate = slotsByDate[date]
      .slice(0, 3)
      .map(slot => {
        const timeObj = new Date(slot);
        return new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }).format(timeObj);
      });
    
    response += timesForDate.join(', ');
    
    if (dateIndex < selectedDates.length - 1) {
      response += '; ';
    } else {
      response += '. ';
    }
  });
  
  response += "Would any of these times work for you?";
  
  return response;
}

// Define CORS headers for development/testing
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Direct-Call',
};

export async function POST(request: Request) {
  const requestStartTime = Date.now();
  logDebug('Received availability check request', {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries([...request.headers])
  });

  try {
    // Handle preflight CORS request
    if (request.method === 'OPTIONS') {
      logDebug('Handling OPTIONS preflight request');
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Parse the request body
    const requestText = await request.text();
    logDebug('Raw request body', requestText);
    
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(requestText);
      logDebug('Parsed request body', body);
    } catch (error) {
      logDebug('Error parsing request body', { error: (error as Error).message });
      return NextResponse.json({
        results: [{
          toolCallId: 'parse-error',
          error: 'Invalid JSON in request body'
        }]
      }, { status: 400, headers: corsHeaders });
    }

    // Extract toolCallId and parameters
    let toolCallId = 'unknown';
    let startDate: string | undefined;
    let endDate: string | undefined;
    let specificTime: Date | undefined; // For handling specific time requests

    // Try to parse parameters from the VAPI message structure
    try {
      logDebug('Attempting to extract parameters from request');
      
      // Case 1: Direct API call format
      if (body.startDate && body.endDate) {
        logDebug('Processing direct API call format');
        toolCallId = 'direct-call';
        startDate = String(body.startDate);
        endDate = String(body.endDate);
      }
      // Case 2: Standard VAPI format
      else if ('id' in body && 'type' in body && body.type === 'function') {
        logDebug('Processing standard VAPI format');
        const vapiBody = body as unknown as VapiToolCall;
        toolCallId = vapiBody.id;
        
        // Try to extract from arguments (either string or object)
        if (vapiBody.function?.arguments) {
          if (typeof vapiBody.function.arguments === 'string') {
            logDebug('Parsing function arguments from string');
            const args = JSON.parse(vapiBody.function.arguments) as { startDate?: string; endDate?: string };
            startDate = args.startDate;
            endDate = args.endDate;
          } else {
            logDebug('Using direct object arguments');
            startDate = vapiBody.function.arguments.startDate;
            endDate = vapiBody.function.arguments.endDate;
          }
        } 
        // Try to extract from parameters
        else if (vapiBody.function?.parameters) {
          logDebug('Using parameters');
          startDate = vapiBody.function.parameters.startDate;
          endDate = vapiBody.function.parameters.endDate;
        }
      }
      // Case 3: New VAPI nested message format
      else if (body.message) {
        logDebug('Processing new VAPI nested message format');
        const vapiMessage = body as unknown as VapiMessage;
        
        // Try to extract from toolCalls array
        if (vapiMessage.message?.toolCalls && vapiMessage.message.toolCalls.length > 0) {
          const toolCall = vapiMessage.message.toolCalls[0];
          toolCallId = toolCall.id;
          
          if (typeof toolCall.function?.arguments === 'string') {
            logDebug('Parsing arguments from toolCalls');
            const args = JSON.parse(toolCall.function.arguments) as { startDate?: string; endDate?: string };
            startDate = args.startDate;
            endDate = args.endDate;
          }
        }
        // Try to extract from toolCallList array
        else if (vapiMessage.message?.toolCallList && vapiMessage.message.toolCallList.length > 0) {
          const toolCall = vapiMessage.message.toolCallList[0];
          toolCallId = toolCall.id;
          
          if (typeof toolCall.function?.arguments === 'string') {
            logDebug('Parsing arguments from toolCallList');
            const args = JSON.parse(toolCall.function.arguments) as { startDate?: string; endDate?: string };
            startDate = args.startDate;
            endDate = args.endDate;
          } else if (typeof toolCall.function?.arguments === 'object' && toolCall.function?.arguments !== null) {
            logDebug('Using direct object arguments from toolCallList');
            const argsObj = toolCall.function.arguments as Record<string, string>;
            startDate = argsObj.startDate;
            endDate = argsObj.endDate;
          }
        }
        // Try to extract from toolWithToolCallList
        else if (vapiMessage.message?.toolWithToolCallList && vapiMessage.message.toolWithToolCallList.length > 0) {
          const toolWithCall = vapiMessage.message.toolWithToolCallList[0];
          
          if (toolWithCall.toolCall) {
            logDebug('Parsing from toolWithToolCallList');
            toolCallId = toolWithCall.toolCall.id;
            
            if (typeof toolWithCall.toolCall.function?.arguments === 'string') {
              const args = JSON.parse(toolWithCall.toolCall.function.arguments) as { startDate?: string; endDate?: string };
              startDate = args.startDate;
              endDate = args.endDate;
            } else if (typeof toolWithCall.toolCall.function?.arguments === 'object' && toolWithCall.toolCall.function?.arguments !== null) {
              const argsObj = toolWithCall.toolCall.function.arguments as Record<string, string>;
              startDate = argsObj.startDate;
              endDate = argsObj.endDate;
            }
          }
        }
      }
      
      // Check if we extracted the required parameters
      if (startDate && endDate) {
        logDebug('Successfully extracted parameters', { toolCallId, startDate, endDate });
      } else {
        logDebug('Failed to extract required parameters');
        return NextResponse.json({
          results: [{
            toolCallId,
            error: 'Could not extract startDate and endDate from the request'
          }]
        }, { status: 400, headers: corsHeaders });
      }
      
    } catch (error) {
      logDebug('Error extracting parameters', { error: (error as Error).message });
      return NextResponse.json({
        results: [{
          toolCallId,
          error: `Error extracting parameters: ${(error as Error).message}`
        }]
      }, { status: 400, headers: corsHeaders });
    }

    // Validate required parameters
    if (!startDate || !endDate) {
      logDebug('Missing required parameters');
      return NextResponse.json({
        results: [{
          toolCallId,
          error: 'Missing required parameters: startDate and endDate'
        }]
      }, { status: 400, headers: corsHeaders });
    }

    // Check if there's a specific time request in user query
    // Parse dates
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    if (Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime())) {
      logDebug('Invalid date format', { startDate, endDate });
      return NextResponse.json({
        results: [{
          toolCallId,
          error: 'Invalid date format provided'
        }]
      }, { status: 400, headers: corsHeaders });
    }

    // Check if dates are in the past
    if (isDateInPast(startDateObj)) {
      logDebug('Start date is in the past', { startDate });
      return NextResponse.json({
        results: [{
          toolCallId,
          error: 'The requested start date is in the past. Please provide a future date.'
        }]
      }, { status: 400, headers: corsHeaders });
    }

    // Handle time zone conversion for clarity
    const startDateLocal = convertToPacificTime(startDateObj);
    const endDateLocal = convertToPacificTime(endDateObj);

    logDebug('Checking availability for range', {
      start: startDateObj.toISOString(),
      end: endDateObj.toISOString(),
      startLocal: startDateLocal.toString(),
      endLocal: endDateLocal.toString()
    });

    // Check if this is a specific time request (when start and end are close together)
    const timeDiffMs = endDateObj.getTime() - startDateObj.getTime();
    if (timeDiffMs < 60 * 60 * 1000) { // Less than 1 hour difference
      specificTime = new Date((startDateObj.getTime() + endDateObj.getTime()) / 2);
      logDebug('Detected specific time request', { specificTime: specificTime.toISOString() });
    }

    // Find available slots
    const availableSlots = await findAvailableSlots(startDateObj, endDateObj);
    logDebug('Found available slots', { count: availableSlots.length });
    
    // Format the response
    const responseMessage = formatAvailabilityResponse(availableSlots, specificTime);
    logDebug('Formatted response', { responseMessage });

    // Return in VAPI tool call response format with CORS headers
    const response = {
      results: [{
        toolCallId,
        result: responseMessage
      }]
    };
    
    const responseTime = Date.now() - requestStartTime;
    logDebug('Sending response', { 
      responseTime: `${responseTime}ms`,
      response
    });
    
    return NextResponse.json(response, {
      headers: corsHeaders
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logDebug('Error processing request', { error: errorMsg, stack: error instanceof Error ? error.stack : 'No stack trace' });
    
    // Return error in VAPI tool call response format with CORS headers
    return NextResponse.json({
      results: [{
        toolCallId: 'error',
        error: `Failed to check availability: ${errorMsg}`
      }]
    }, { 
      status: 500,
      headers: corsHeaders
    });
  } finally {
    try {
      await prisma.$disconnect();
      logDebug('Prisma connection closed');
    } catch (error) {
      logDebug('Error disconnecting from Prisma', { error: String(error) });
    }
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
} 