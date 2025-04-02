/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

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

// Helper function to convert date to Central Time
function convertToCentralTime(date: Date): Date {
  return new Date(date.toLocaleString('en-US', {
    timeZone: 'America/Chicago'
  }));
}

// Check if a date is in the past with buffer minutes
function isDateInPast(date: Date, bufferMinutes = 15): boolean {
  const now = new Date();
  // Add buffer to allow slightly past dates
  const bufferedDate = new Date(date.getTime() + bufferMinutes * 60 * 1000);
  return bufferedDate < now;
}

// Check if a date is a business day (Monday-Friday)
function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 0 = Sunday, 6 = Saturday
}

// Define an interface for appointment data
interface Appointment {
  date: Date;
  id?: string;
  patientId?: string;
  status?: string;
  patient?: {
    firstName?: string;
    lastName?: string;
  };
  // Add other fields as needed
}

// Find available appointment slots for a given date
function findAvailableSlots(date: Date, existingAppointments: Appointment[]): string[] {
  // Convert input date to Central Time for business hour validation
  const centralDate = convertToCentralTime(date);
  
  // Define standard appointment slots (30 minutes each, from 9am to 5pm Central Time)
  const APPOINTMENT_SLOTS = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', 
    '15:00', '15:30', '16:00', '16:30', '17:00'
  ];
  
  // If not a business day in Central Time, no slots available
  if (!isBusinessDay(centralDate)) {
    return [];
  }
  
  // Filter out slots that already have appointments
  const bookedTimes = existingAppointments.map(appt => 
    new Date(appt.date).toLocaleTimeString('en-US', {
      timeZone: 'America/Chicago',
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    })
  );
  
  return APPOINTMENT_SLOTS.filter(slot => !bookedTimes.includes(slot));
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
async function findAvailableSlotsForRange(startDate: Date, endDate: Date, existingAppointments: Appointment[]): Promise<string[]> {
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
    const existingAppointmentsInRange = await prisma.appointment.findMany({
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
    
    logDebug(`Found ${existingAppointmentsInRange.length} existing appointments in range`);
    
    // Create a map of booked slots
    const bookedSlots = new Set(
      existingAppointmentsInRange.map(apt => apt.date.toISOString())
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
          if (isDateInPast(slotDateTime, 15)) {
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

// Add a function to extract time from user message
function extractRequestedTimeFromMessage(messages: { role: string; message: string }[]): { date: string | null, time: string | null } {
  try {
    // Find the most recent user message
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return { date: null, time: null };
    
    const lastUserMessage = userMessages[userMessages.length - 1].message;
    logDebug(`Extracting time from user message: ${lastUserMessage}`);
    
    // Regex patterns for date and time extraction
    const datePattern = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/i;
    const timePattern = /(\d{1,2})(?::|\s+)(\d{2})?\s*(am|pm)?/i;
    
    // Extract date and time
    const dateMatch = lastUserMessage.match(datePattern);
    const timeMatch = lastUserMessage.match(timePattern);
    
    const date = dateMatch ? `${dateMatch[1]} ${dateMatch[2]}` : null;
    const time = timeMatch ? `${timeMatch[1]}:${timeMatch[2] || '00'} ${timeMatch[3] || 'PM'}` : null;
    
    logDebug(`Extracted date: ${date}, time: ${time}`);
    return { date, time };
  } catch (error) {
    logDebug(`Error extracting time from message: ${error}`);
    return { date: null, time: null };
  }
}

// Function to check if a specific slot is available
function isTimeSlotAvailable(requestedTime: Date, availableSlots: string[]): boolean {
  // Format the requested time to match the slot format
  const hours = requestedTime.getUTCHours();
  const minutes = requestedTime.getUTCMinutes();
  const formattedTime = `${hours === 0 ? 12 : hours > 12 ? hours - 12 : hours}:${minutes === 0 ? '00' : minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
  
  // Check if this time appears in any of the available slots
  return availableSlots.some(slot => {
    const slotDate = new Date(slot);
    const slotHours = slotDate.getUTCHours();
    const slotMinutes = slotDate.getUTCMinutes();
    const slotFormatted = `${slotHours === 0 ? 12 : slotHours > 12 ? slotHours - 12 : slotHours}:${slotMinutes === 0 ? '00' : slotMinutes} ${slotHours >= 12 ? 'PM' : 'AM'}`;
    return slotFormatted.includes(formattedTime);
  });
}

// Fix the formatAvailabilityResponse function to properly handle the null case and missing response
function formatAvailabilityResponse(availableSlots: string[], requestedSpecificTime?: Date | null): string {
  if (availableSlots.length === 0) {
    return "I'm sorry, but there are no appointment slots available in the requested timeframe. Would you like to try a different date range?";
  }
  
  // If we have a specific requested time from the user message, address it first
  if (requestedSpecificTime) {
    const isRequestedTimeAvailable = isTimeSlotAvailable(requestedSpecificTime, availableSlots);
    
    // Format the requested time for response
    const hours = requestedSpecificTime.getUTCHours();
    const minutes = requestedSpecificTime.getUTCMinutes();
    const formattedTime = `${hours === 0 ? 12 : hours > 12 ? hours - 12 : hours}:${minutes === 0 ? '00' : minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
    
    if (isRequestedTimeAvailable) {
      return `Yes, we have availability at ${formattedTime} on ${requestedSpecificTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. Would you like to book this appointment?`;
    }
    
    // Not available case - create response for alternatives
    const response = `I'm sorry, but ${formattedTime} on ${requestedSpecificTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} is not available. However, we do have other times available. `;
    
    // We'll continue with the standard response logic for alternatives by falling through
    // to the code below, but starting with our custom message
    return response + getAlternativeTimesMessage(availableSlots, requestedSpecificTime);
  }
  
  // Default case - no specific time requested
  return `We have several appointment slots available. ${getAlternativeTimesMessage(availableSlots)}`;
}

// Helper function to generate the alternative times message
function getAlternativeTimesMessage(availableSlots: string[], referenceTime?: Date | null): string {
  // Group slots by date
  const slotsByDate: Record<string, string[]> = {};
  
  // Sort slots by time
  availableSlots.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  
  // If a reference time was provided, try to find slots close to it
  let closestSlots: string[] = [];
  if (referenceTime) {
    const referenceTimeMs = referenceTime.getTime();
    // Sort by proximity to the reference time
    closestSlots = [...availableSlots].sort((a, b) => {
      const diffA = Math.abs(new Date(a).getTime() - referenceTimeMs);
      const diffB = Math.abs(new Date(b).getTime() - referenceTimeMs);
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
  
  // Sort dates and limit to first 3 days with availability
  const sortedDates = Object.keys(slotsByDate).sort();
  const selectedDates = sortedDates.slice(0, 3);
  
  let response = "";
  
  // If there was a specific requested time and we found close alternatives
  if (referenceTime && closestSlots.length > 0) {
    response = "The closest available times are: ";
    for (const slot of closestSlots) {
      const date = new Date(slot);
      response += `${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}, `;
    }
    response = `${response.slice(0, -2)}. `; // Remove the last comma and space
  } else {
    // Standard response with available days
    for (const date of selectedDates) {
      const formattedDate = formatDate(date);
      const times = slotsByDate[date].slice(0, 3).map(slot => {
        const slotTime = new Date(slot);
        return slotTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      });
      response += `${formattedDate} at ${times.join(', ')}. `;
    }
  }
  
  return `${response}Would any of these times work for you?`;
}

// Format the result in a human-readable way
function formatResponseForHuman(date: Date, slots: string[]): string {
  // Format date for display in Central Time
  const formattedDate = date.toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  if (slots.length === 0) {
    return `No available appointment slots on ${formattedDate} (Central Time).`;
  }
  
  // Format slots for display
  const formattedSlots = slots.map(slot => {
    const [hours, minutes] = slot.split(':');
    return `${hours}:${minutes}`;
  });
  
  return `Available appointment slots on ${formattedDate} (Central Time): ${formattedSlots.join(', ')}`;
}

// Define CORS headers for development/testing
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Direct-Call',
};

export async function POST(request: Request) {
  const requestStartTime = Date.now();
  let toolCallId = 'unknown';
  
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

    // Extract request body
    const body = await request.json();
    logDebug('Raw request body', JSON.stringify(body));
    logDebug('Parsed request body', body);

    // Extract toolCallId from various possible request formats
    if (body.message?.toolCalls?.[0]?.id) {
      toolCallId = body.message.toolCalls[0].id;
    } else if (body.message?.toolCallList?.[0]?.id) {
      toolCallId = body.message.toolCallList[0].id;
    } else if (body.message?.toolWithToolCallList?.[0]?.toolCall?.id) {
      toolCallId = body.message.toolWithToolCallList[0].toolCall.id;
    } else if (body.id) {
      toolCallId = body.id;
    }

    // Extract user message from conversation context to understand intent
    let userMessage = '';
    if (body.message?.artifact?.messages) {
      const userMessages = body.message.artifact.messages.filter((m: { role: string; message: string }) => m.role === 'user');
      if (userMessages.length > 0) {
        userMessage = userMessages[userMessages.length - 1].message;
        logDebug('Extracted user message', { userMessage });
      }
    }

    // Extract date parameters for context
    let startDate = '';
    let endDate = '';
    let dateContext = '';

    // Try to extract from various request formats
    if (body.message?.toolCalls?.[0]?.function?.arguments) {
      const args = typeof body.message.toolCalls[0].function.arguments === 'string' 
        ? JSON.parse(body.message.toolCalls[0].function.arguments)
        : body.message.toolCalls[0].function.arguments;
      
      startDate = args.startDate || '';
      endDate = args.endDate || '';
    } else if (body.message?.toolCallList?.[0]?.function?.arguments) {
      const args = typeof body.message.toolCallList[0].function.arguments === 'string'
        ? JSON.parse(body.message.toolCallList[0].function.arguments)
        : body.message.toolCallList[0].function.arguments;
      
      startDate = args.startDate || '';
      endDate = args.endDate || '';
    } else if (body.startDate && body.endDate) {
      startDate = body.startDate;
      endDate = body.endDate;
    }

    // Normalize dates if available
    if (startDate) startDate = normalizeDateString(startDate);
    if (endDate) endDate = normalizeDateString(endDate);

    if (startDate && endDate) {
      const startObj = new Date(startDate);
      const endObj = new Date(endDate);
      
      dateContext = `The user is looking for availability between ${startObj.toLocaleDateString('en-US', {
        weekday: 'long', 
        month: 'long', 
        day: 'numeric'
      })} at ${startObj.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      })} and ${endObj.toLocaleDateString('en-US', {
        weekday: 'long', 
        month: 'long', 
        day: 'numeric'
      })} at ${endObj.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      })}.`;
    }

    // Get all existing appointments from database (for the next 14 days)
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
    
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        date: {
          gte: new Date(),
          lte: twoWeeksLater
        },
        status: {
          in: ['SCHEDULED', 'CONFIRMED'] // Only consider active appointments
        }
      },
      select: {
        date: true,
        patient: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });
    
    logDebug('Retrieved existing appointments', { count: existingAppointments.length });

    // Format appointments for the AI context
    const appointmentsFormatted = existingAppointments.map(apt => {
      const dateObj = new Date(apt.date);
      return {
        date: dateObj.toISOString(),
        formattedDate: dateObj.toLocaleDateString('en-US', { 
          timeZone: 'UTC',
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        time: dateObj.toLocaleTimeString('en-US', { 
          timeZone: 'UTC',
          hour: 'numeric', 
          minute: '2-digit'
        }),
        timeZone: 'UTC'
      };
    });

    // Generate all available slots for the given date range or next 7 days
    let availableSlots: string[] = [];
    if (startDate && endDate) {
      availableSlots = await findAvailableSlotsForRange(new Date(startDate), new Date(endDate), existingAppointments);
    } else {
      // Default to next 7 days if no specific dates provided
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      availableSlots = await findAvailableSlotsForRange(new Date(), nextWeek, existingAppointments);
    }

    // Format available slots for AI context
    const availableSlotsFormatted = availableSlots.map(slot => {
      const dateObj = new Date(slot);
      return {
        date: dateObj.toISOString(),
        formattedDate: dateObj.toLocaleDateString('en-US', { 
          timeZone: 'UTC',
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        time: dateObj.toLocaleTimeString('en-US', { 
          timeZone: 'UTC',
          hour: 'numeric', 
          minute: '2-digit'
        }),
        timeZone: 'UTC'
      };
    });

    // Prepare system instructions for GPT
    const systemPrompt = `You are an AI assistant for a dental practice that checks appointment availability. 
The practice is open Monday-Friday from 9:00 AM to 5:00 PM, with appointments scheduled every 30 minutes.
Today's date is ${new Date().toLocaleDateString()}.

Here are the currently booked appointments:
${JSON.stringify(appointmentsFormatted, null, 2)}

Here are the available appointment slots:
${JSON.stringify(availableSlotsFormatted.slice(0, 20), null, 2)}
${availableSlotsFormatted.length > 20 ? `... and ${availableSlotsFormatted.length - 20} more slots` : ''}

When responding about availability:
1. Always directly address the specific date and time the person asked about if mentioned.
2. If they requested a specific time (like "1:30 PM on April 3rd"), check if that exact time is available first.
3. If a requested time is unavailable, offer 2-3 alternatives nearby.
4. For date ranges, show 2-3 available times for each of the next 3 available days.
5. Format times in a natural, easy-to-understand way (e.g., "1:30 PM on Thursday, April 3rd").
6. Only show available slots (not booked appointments).
7. End your response by asking if any of the times work for them.

Respond conversationally but concisely.`;

    // Combine user message and date context for better understanding
    const userQuery = userMessage 
      ? `The user asked: "${userMessage}"`
      : dateContext || "The user is checking appointment availability";

    // Use AI SDK to generate a response
    logDebug('Sending request to AI', { systemPrompt, userQuery });
    
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      messages: [{ role: 'user', content: userQuery }],
    });
    
    logDebug('Received AI response', { aiResponse: result });

    // Return in VAPI tool call response format
    const responseObj = {
      results: [{
        toolCallId,
        result: result
      }]
    };
    
    const responseTime = Date.now() - requestStartTime;
    logDebug('Sending response', { 
      responseTime: `${responseTime}ms`,
      response: responseObj
    });
    
    return NextResponse.json(responseObj, {
      headers: corsHeaders
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logDebug('Error processing request', { error: errorMsg, stack: error instanceof Error ? error.stack : 'No stack trace' });
    
    // Return error in VAPI tool call response format with CORS headers
    return NextResponse.json({
      results: [{
        toolCallId,
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