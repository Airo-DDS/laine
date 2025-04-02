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

// Helper function to normalize dates
function normalizeDateString(dateStr: string): string {
  if (!dateStr) return '';
  
  try {
    // Handle non-ISO date format (MM-DD-YY HH:MM:SS)
    if (dateStr.match(/^\d{2}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/)) {
      logDebug('Found non-ISO date format, converting', { original: dateStr });
      const [datePart, timePart] = dateStr.split(' ');
      const [month, day, year] = datePart.split('-');
      // Convert to ISO format, assuming 20XX for the year
      return `20${year}-${month}-${day}T${timePart}Z`;
    }
    
    // Fix dates from 2024 to current year if we're past that date
    const currentYear = new Date().getFullYear();
    const date = new Date(dateStr);
    
    if (date.getFullYear() === 2024 && currentYear > 2024) {
      logDebug('Updating year from 2024 to current year', { 
        original: dateStr, 
        year: currentYear 
      });
      
      date.setFullYear(currentYear);
      return date.toISOString();
    }
    
    // Return original if already in ISO format
    return dateStr;
  } catch (error) {
    logDebug('Error normalizing date string', { dateStr, error: String(error) });
    return dateStr; // Return original if parsing fails
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
function isDateInPast(date: Date, bufferMinutes = 15): boolean {
  const now = new Date();
  // Add buffer minutes to allow for some flexibility
  const bufferMs = bufferMinutes * 60 * 1000;
  const bufferedDate = new Date(date.getTime() + bufferMs);
  return bufferedDate < now;
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
        logDebug('Extracted parameters from direct format', { startDate, endDate });
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
            try {
              const args = JSON.parse(vapiBody.function.arguments) as { startDate?: string; endDate?: string };
              startDate = args.startDate;
              endDate = args.endDate;
              logDebug('Successfully parsed arguments from string', { startDate, endDate });
            } catch (parseError) {
              logDebug('Failed to parse arguments from string', { 
                error: String(parseError),
                argumentsStr: vapiBody.function.arguments 
              });
            }
          } else {
            logDebug('Using direct object arguments', vapiBody.function.arguments);
            const args = vapiBody.function.arguments as Record<string, string>;
            startDate = args.startDate;
            endDate = args.endDate;
          }
        } 
        // Try to extract from parameters
        else if (vapiBody.function?.parameters) {
          logDebug('Using parameters', vapiBody.function.parameters);
          startDate = vapiBody.function.parameters.startDate;
          endDate = vapiBody.function.parameters.endDate;
        }
      }
      // Case 3: New VAPI nested message format - with improved extraction
      else if (body.message) {
        logDebug('Processing new VAPI nested message format');
        
        const messageObj = body.message as Record<string, unknown>;
        logDebug('Message object structure', { 
          hasToolCalls: Boolean(messageObj.toolCalls),
          hasToolCallList: Boolean(messageObj.toolCallList),
          hasToolWithToolCallList: Boolean(messageObj.toolWithToolCallList),
          keys: Object.keys(messageObj)
        });
        
        // First try to extract from toolCalls array
        if (Array.isArray(messageObj.toolCalls) && messageObj.toolCalls.length > 0) {
          const toolCall = messageObj.toolCalls[0] as Record<string, unknown>;
          logDebug('Extracting from toolCalls[0]', toolCall);
          
          if (toolCall.id) {
            toolCallId = String(toolCall.id);
          }
          
          const funcObj = toolCall.function as Record<string, unknown>;
          if (funcObj) {
            if (typeof funcObj.arguments === 'string') {
              try {
                logDebug('Parsing arguments string from toolCalls', funcObj.arguments);
                const args = JSON.parse(funcObj.arguments as string) as Record<string, string>;
                startDate = args.startDate;
                endDate = args.endDate;
                logDebug('Successfully extracted from toolCalls string arguments', { startDate, endDate });
              } catch (error) {
                logDebug('Error parsing arguments from toolCalls', { error: String(error) });
              }
            } else if (typeof funcObj.arguments === 'object' && funcObj.arguments !== null) {
              const args = funcObj.arguments as Record<string, unknown>;
              logDebug('Direct arguments object from toolCalls', args);
              startDate = args.startDate ? String(args.startDate) : undefined;
              endDate = args.endDate ? String(args.endDate) : undefined;
              logDebug('Extracted from toolCalls object arguments', { startDate, endDate });
            }
          }
        }
        
        // If first attempt failed, try extracting from toolCallList
        if ((!startDate || !endDate) && Array.isArray(messageObj.toolCallList) && messageObj.toolCallList.length > 0) {
          const toolCall = messageObj.toolCallList[0] as Record<string, unknown>;
          logDebug('Extracting from toolCallList[0]', toolCall);
          
          if (toolCall.id) {
            toolCallId = String(toolCall.id);
          }
          
          const funcObj = toolCall.function as Record<string, unknown>;
          if (funcObj) {
            if (typeof funcObj.arguments === 'string') {
              try {
                logDebug('Parsing arguments string from toolCallList', funcObj.arguments);
                const args = JSON.parse(funcObj.arguments as string) as Record<string, string>;
                startDate = args.startDate;
                endDate = args.endDate;
                logDebug('Successfully extracted from toolCallList string arguments', { startDate, endDate });
              } catch (error) {
                logDebug('Error parsing arguments from toolCallList', { error: String(error) });
              }
            } else if (typeof funcObj.arguments === 'object' && funcObj.arguments !== null) {
              const args = funcObj.arguments as Record<string, unknown>;
              logDebug('Direct arguments object from toolCallList', args);
              startDate = args.startDate ? String(args.startDate) : undefined;
              endDate = args.endDate ? String(args.endDate) : undefined;
              logDebug('Extracted from toolCallList object arguments', { startDate, endDate });
            }
          }
        }
        
        // Last attempt from toolWithToolCallList
        if ((!startDate || !endDate) && Array.isArray(messageObj.toolWithToolCallList) && messageObj.toolWithToolCallList.length > 0) {
          const toolWithCall = messageObj.toolWithToolCallList[0] as Record<string, unknown>;
          logDebug('Extracting from toolWithToolCallList[0]', toolWithCall);
          
          if (toolWithCall.toolCall) {
            const toolCall = toolWithCall.toolCall as Record<string, unknown>;
            
            if (toolCall.id) {
              toolCallId = String(toolCall.id);
            }
            
            const funcObj = toolCall.function as Record<string, unknown>;
            if (funcObj) {
              if (typeof funcObj.arguments === 'string') {
                try {
                  logDebug('Parsing arguments string from toolWithToolCallList', funcObj.arguments);
                  const args = JSON.parse(funcObj.arguments as string) as Record<string, string>;
                  startDate = args.startDate;
                  endDate = args.endDate;
                  logDebug('Successfully extracted from toolWithToolCallList string arguments', { startDate, endDate });
                } catch (error) {
                  logDebug('Error parsing arguments from toolWithToolCallList', { error: String(error) });
                }
              } else if (typeof funcObj.arguments === 'object' && funcObj.arguments !== null) {
                const args = funcObj.arguments as Record<string, unknown>;
                logDebug('Direct arguments object from toolWithToolCallList', args);
                startDate = args.startDate ? String(args.startDate) : undefined;
                endDate = args.endDate ? String(args.endDate) : undefined;
                logDebug('Extracted from toolWithToolCallList object arguments', { startDate, endDate });
              }
            }
          }
        }
      }
      
      // Normalize date formats (fix years, handle different formats)
      if (startDate) {
        startDate = normalizeDateString(startDate);
      }
      
      if (endDate) {
        endDate = normalizeDateString(endDate);
      }
      
      // Check if we extracted the required parameters
      if (startDate && endDate) {
        logDebug('Successfully extracted parameters', { toolCallId, startDate, endDate });
      } else {
        logDebug('Failed to extract required parameters', { 
          foundStart: Boolean(startDate), 
          foundEnd: Boolean(endDate),
          bodyKeys: Object.keys(body)
        });
        
        // Last attempt: search for startDate/endDate anywhere in the request
        const flattenAndSearch = (obj: Record<string, unknown>, depth = 0, path = ''): void => {
          // Limit recursion depth to prevent stack overflow
          if (depth > 10) return;
          
          for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key;
            
            if (key === 'startDate' && !startDate && typeof value === 'string') {
              startDate = normalizeDateString(value);
              logDebug(`Found startDate at ${currentPath}`, { value, normalized: startDate });
            }
            
            if (key === 'endDate' && !endDate && typeof value === 'string') {
              endDate = normalizeDateString(value);
              logDebug(`Found endDate at ${currentPath}`, { value, normalized: endDate });
            }
            
            if (typeof value === 'object' && value !== null) {
              flattenAndSearch(value as Record<string, unknown>, depth + 1, currentPath);
            }
          }
        };
        
        // Only perform deep search if we still don't have dates
        if (!startDate || !endDate) {
          logDebug('Attempting deep search for date parameters');
          flattenAndSearch(body as Record<string, unknown>);
        }
        
        // If still not found, return error
        if (!startDate || !endDate) {
          return NextResponse.json({
            results: [{
              toolCallId,
              error: 'Could not extract startDate and endDate from the request'
            }]
          }, { status: 400, headers: corsHeaders });
        }
      }
      
    } catch (error) {
      logDebug('Error extracting parameters', { error: (error as Error).message, stack: (error as Error).stack });
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
    const now = new Date();
    if (isDateInPast(startDateObj)) {
      // If it's today but earlier, just set to now + 30 minutes for some wiggle room
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const isPastButToday = 
        startDateObj.getFullYear() === today.getFullYear() &&
        startDateObj.getMonth() === today.getMonth() && 
        startDateObj.getDate() === today.getDate();
      
      if (isPastButToday) {
        logDebug('Adjusting past date from today to current time + 30 min', { original: startDate });
        // Set to now + 30 minutes
        startDateObj.setTime(now.getTime() + 30 * 60 * 1000);
        startDate = startDateObj.toISOString();
      } else {
        logDebug('Start date is in the past', { 
          startDate,
          startDateObj: startDateObj.toString(),
          now: now.toString() 
        });
        
        return NextResponse.json({
          results: [{
            toolCallId,
            error: 'The requested start date is in the past. Please provide a future date.'
          }]
        }, { status: 400, headers: corsHeaders });
      }
    }

    // Always ensure endDate is after startDate
    if (endDateObj <= startDateObj) {
      logDebug('End date is not after start date, adjusting', {
        startDate,
        endDate
      });
      // Set end date to startDate + 30 minutes
      endDateObj.setTime(startDateObj.getTime() + 30 * 60 * 1000);
      endDate = endDateObj.toISOString();
    }

    // Handle time zone conversion for clarity
    const startDateLocal = convertToPacificTime(startDateObj);
    const endDateLocal = convertToPacificTime(endDateObj);

    logDebug('Final date parameters after normalization and validation', {
      start: startDate,
      end: endDate,
      startLocal: startDateLocal.toString(),
      endLocal: endDateLocal.toString()
    });

    // Check if this is a specific time request (when start and end are close together)
    const timeDiffMs = endDateObj.getTime() - startDateObj.getTime();
    if (timeDiffMs < 60 * 60 * 1000) { // Less than 1 hour difference
      specificTime = new Date((startDateObj.getTime() + endDateObj.getTime()) / 2);
      logDebug('Detected specific time request', { 
        specificTime: specificTime.toISOString(),
        timeDiff: `${Math.round(timeDiffMs / 60000)} minutes`
      });
    } else {
      logDebug('Detected time range request', { 
        timeDiff: `${Math.round(timeDiffMs / 60000)} minutes`,
        hours: Math.round(timeDiffMs / 3600000)
      });
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