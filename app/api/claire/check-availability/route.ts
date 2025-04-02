import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// VAPI Tool Call Interface
interface VapiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    parameters?: {
      startDate?: string;
      endDate?: string;
    };
    arguments?: string; // JSON string containing parameters
  };
  messages: Array<{
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
  // Ensure we're working with dates with zeroed-out time components
  const startDateCopy = new Date(startDate);
  startDateCopy.setHours(0, 0, 0, 0);
  
  const endDateCopy = new Date(endDate);
  endDateCopy.setHours(23, 59, 59, 999);
  
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
        const slotISOString = slotDateTime.toISOString();
        
        // Check if this slot is available
        if (!bookedSlots.has(slotISOString)) {
          availableSlots.push(slotISOString);
        }
      }
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return availableSlots;
}

// Format the available slots into a human-readable response
function formatAvailabilityResponse(availableSlots: string[]): string {
  if (availableSlots.length === 0) {
    return "I'm sorry, but there are no appointment slots available in the requested timeframe. Would you like to try a different date range?";
  }
  
  // Group slots by date
  const slotsByDate: Record<string, string[]> = {};
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

export async function POST(request: Request) {
  try {
    // Handle preflight CORS request
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Parse the request body
    const body = await request.json() as VapiToolCall | { startDate: string; endDate: string };
    console.log('Received request body:', JSON.stringify(body, null, 2));

    // Extract toolCallId and parameters
    let toolCallId: string;
    let startDate: string;
    let endDate: string;

    if ('id' in body && 'type' in body && body.type === 'function') {
      // Handle VAPI tool call format
      const vapiBody = body as VapiToolCall;
      toolCallId = vapiBody.id;
      console.log('Processing VAPI tool call with ID:', toolCallId);
      
      // Parse parameters from function arguments
      if (typeof vapiBody.function?.arguments === 'string') {
        console.log('Parsing function arguments:', vapiBody.function.arguments);
        const args = JSON.parse(vapiBody.function.arguments) as { startDate: string; endDate: string };
        startDate = args.startDate;
        endDate = args.endDate;
        console.log('Parsed dates:', { startDate, endDate });
      } else if (vapiBody.function?.parameters) {
        console.log('Using direct parameters');
        const params = vapiBody.function.parameters;
        if (!params.startDate || !params.endDate) {
          console.log('Missing required parameters');
          return NextResponse.json({
            results: [{
              toolCallId,
              error: 'Missing required parameters: startDate and endDate'
            }]
          }, { status: 400 });
        }
        startDate = params.startDate;
        endDate = params.endDate;
        console.log('Using parameters:', { startDate, endDate });
      } else {
        console.log('No valid parameters found in request');
        return NextResponse.json({
          results: [{
            toolCallId,
            error: 'Missing or invalid parameters in the request'
          }]
        }, { status: 400 });
      }
    } else {
      // Handle direct API call format
      console.log('Processing direct API call');
      toolCallId = 'direct-call';
      const directBody = body as { startDate: string; endDate: string };
      startDate = directBody.startDate;
      endDate = directBody.endDate;
    }

    // Validate required parameters
    if (!startDate || !endDate) {
      console.log('Missing required parameters');
      return NextResponse.json({
        results: [{
          toolCallId,
          error: 'Missing required parameters: startDate and endDate'
        }]
      }, { status: 400 });
    }

    // Parse dates
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    if (Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime())) {
      console.log('Invalid date format:', { startDate, endDate });
      return NextResponse.json({
        results: [{
          toolCallId,
          error: 'Invalid date format provided'
        }]
      }, { status: 400 });
    }

    console.log('Checking availability for range:', {
      start: startDateObj.toISOString(),
      end: endDateObj.toISOString()
    });

    // Find available slots
    const availableSlots = await findAvailableSlots(startDateObj, endDateObj);
    console.log('Found available slots:', availableSlots.length);
    
    // Format the response
    const responseMessage = formatAvailabilityResponse(availableSlots);
    console.log('Formatted response:', responseMessage);

    // Return in VAPI tool call response format
    const response = {
      results: [{
        toolCallId,
        result: responseMessage
      }]
    };
    console.log('Sending response:', JSON.stringify(response, null, 2));
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error processing request:', error);
    
    // Return error in VAPI tool call response format
    return NextResponse.json({
      results: [{
        toolCallId: 'error',
        error: `Failed to check availability: ${error instanceof Error ? error.message : String(error)}`
      }]
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 