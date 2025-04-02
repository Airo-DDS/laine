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

// Day of week mapping for date calculations
const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

// Helper to find the next occurrence of a day of the week
function getNextDayOfWeek(dayName: string, fromDate = new Date()): Date {
  const targetDay = DAYS_OF_WEEK.findIndex(
    day => day.toLowerCase() === dayName.toLowerCase()
  );
  
  if (targetDay === -1) return fromDate; // Invalid day name
  
  const today = fromDate.getDay();
  const daysToAdd = (targetDay + 7 - today) % 7;
  
  const result = new Date(fromDate);
  result.setDate(result.getDate() + (daysToAdd === 0 ? 7 : daysToAdd));
  return result;
}

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
  
  // Create a date object from the string
  const parsedDate = new Date(dateString);
  
  // Check if date string is a valid ISO format date
  if (!Number.isNaN(parsedDate.getTime())) {
    // Extract the day of week from the parsed date
    const dayOfWeek = DAYS_OF_WEEK[parsedDate.getDay()];
    
    log('Parsed date information', {
      originalDate: dateString,
      parsedDate: parsedDate.toISOString(),
      dayOfWeek
    });
    
    // Always use the NEXT occurrence of that day of week from today
    const correctDayOfWeekDate = getNextDayOfWeek(dayOfWeek, currentTime);
    
    // Keep the time from the original parsed date
    correctDayOfWeekDate.setHours(parsedDate.getHours());
    correctDayOfWeekDate.setMinutes(parsedDate.getMinutes());
    correctDayOfWeekDate.setSeconds(parsedDate.getSeconds());
    
    log('Corrected to next occurrence of day of week', {
      originalDate: dateString,
      correctedDate: correctDayOfWeekDate.toISOString(),
      dayOfWeek
    });
    
    return correctDayOfWeekDate;
  }
  
  // If we get here, the date string was not valid ISO format
  // Try to extract day name and time if string contains day reference
  const dayPatterns = [
    { day: 'monday', regex: /\b(mon|monday)\b/i },
    { day: 'tuesday', regex: /\b(tue|tues|tuesday)\b/i },
    { day: 'wednesday', regex: /\b(wed|weds|wednesday)\b/i },
    { day: 'thursday', regex: /\b(thu|thur|thurs|thursday)\b/i },
    { day: 'friday', regex: /\b(fri|friday)\b/i },
    { day: 'saturday', regex: /\b(sat|saturday)\b/i },
    { day: 'sunday', regex: /\b(sun|sunday)\b/i },
  ];
  
  // Check if string contains day reference
  for (const { day, regex } of dayPatterns) {
    if (regex.test(dateString)) {
      // Extract time if available (assuming format like "3pm" or "3:00pm")
      const timeMatch = dateString.match(/(\d{1,2})(?::(\d{2}))?(?:\s*)(am|pm)/i);
      
      const nextDayDate = getNextDayOfWeek(day, currentTime);
      
      // If time was extracted, set it
      if (timeMatch) {
        const hours = Number.parseInt(timeMatch[1], 10);
        const minutes = timeMatch[2] ? Number.parseInt(timeMatch[2], 10) : 0;
        const isPM = timeMatch[3].toLowerCase() === 'pm';
        
        // Convert to 24-hour format
        const adjustedHours = isPM && hours < 12 
          ? hours + 12 
          : (!isPM && hours === 12 ? 0 : hours);
        
        nextDayDate.setHours(adjustedHours, minutes, 0, 0);
      } else {
        // Default to 3PM if no time specified
        nextDayDate.setHours(15, 0, 0, 0);
      }
      
      log('Extracted day reference and created date', {
        originalText: dateString,
        extractedDay: day,
        extractedTime: timeMatch ? `${timeMatch[1]}:${timeMatch[2] || '00'} ${timeMatch[3]}` : 'default 3:00 PM',
        resultDate: nextDayDate.toISOString()
      });
      
      return nextDayDate;
    }
  }
  
  // For demo purposes, use tomorrow at 3:00 PM as fallback
  log('Could not parse date reference, using tomorrow at 3PM as fallback', { 
    originalDate: dateString
  });
  
  const fallbackDate = new Date(currentTime);
  fallbackDate.setDate(fallbackDate.getDate() + 1);
  fallbackDate.setHours(15, 0, 0, 0); // 3:00 PM
  return fallbackDate;
}

// Get current date info for debugging and reference
function getCurrentDateInfo(): Record<string, string> {
  const now = new Date();
  return {
    currentDateTime: now.toISOString(),
    currentDateUTC: now.toUTCString(),
    currentDateLocale: now.toLocaleString(),
    currentDayOfWeek: DAYS_OF_WEEK[now.getDay()],
    nextWednesday: getNextDayOfWeek('wednesday', now).toISOString(),
  };
}

export async function POST(request: Request) {
  log('Received check-availability request');
  log('Current date info', getCurrentDateInfo());
  
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