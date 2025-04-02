import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface VapiToolCallWebhook {
  message: {
    toolCallList?: Array<{
      id: string;
      function?: {
        name: string;
        arguments: string; // JSON string containing parameters
      };
    }>;
    type?: string;
    call?: {
      id: string;
    };
    functionCall?: {
      name: string;
      parameters: string; // JSON string containing parameters (older format)
    };
  };
}

interface CheckAvailabilityParams {
  startDate: string;
  endDate: string;
}

// Parameters from various sources might use different naming conventions
interface RawParameters {
  startDate?: string;
  endDate?: string;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: string | undefined;
}

// Backward compatibility adapter for dateFrom/dateTo parameters
function adaptParameters(params: RawParameters): CheckAvailabilityParams {
  // Handle both naming conventions
  return {
    startDate: params.startDate || params.dateFrom || '',
    endDate: params.endDate || params.dateTo || ''
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

// Generate available slots based on a date range
function generateAvailableSlots(startDate: Date, endDate: Date): string[] {
  const slots: string[] = [];
  const currentDate = new Date(startDate);
  
  // Loop through each day in the range
  while (currentDate <= endDate) {
    // Only include business days
    if (isBusinessDay(currentDate)) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Add each time slot for the day
      for (const slot of APPOINTMENT_SLOTS) {
        slots.push(`${dateStr}T${slot}:00`);
      }
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return slots;
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
    const body = await request.json() as VapiToolCallWebhook;
    console.log('Received webhook payload:', JSON.stringify(body));
    
    let toolCallId: string | undefined;
    let functionParams: CheckAvailabilityParams | undefined;
    
    // Handle both old and new VAPI webhook formats
    if (body.message?.toolCallList && body.message.toolCallList.length > 0) {
      // New format
      const toolCall = body.message.toolCallList[0];
      toolCallId = toolCall.id;
      
      if (toolCall.function?.name !== 'checkAvailability') {
        return NextResponse.json(
          {
            results: [
              {
                toolCallId,
                error: `Invalid function name: ${toolCall.function?.name || 'undefined'}`
              }
            ]
          },
          { status: 400 }
        );
      }
      
      try {
        const parsedParams = JSON.parse(toolCall.function.arguments);
        // Apply parameter adapter
        functionParams = adaptParameters(parsedParams);
      } catch (e) {
        return NextResponse.json(
          {
            results: [
              {
                toolCallId,
                error: `Failed to parse function arguments: ${e instanceof Error ? e.message : String(e)}`
              }
            ]
          },
          { status: 400 }
        );
      }
    } else if (body.message?.functionCall) {
      // Old format
      toolCallId = body.message?.call?.id;
      
      if (body.message.functionCall.name !== 'checkAvailability') {
        return NextResponse.json(
          {
            results: [
              {
                toolCallId,
                error: `Invalid function name: ${body.message.functionCall.name}`
              }
            ]
          },
          { status: 400 }
        );
      }
      
      try {
        const parsedParams = JSON.parse(body.message.functionCall.parameters);
        // Apply parameter adapter
        functionParams = adaptParameters(parsedParams);
      } catch (e) {
        return NextResponse.json(
          {
            results: [
              {
                toolCallId,
                error: `Failed to parse function parameters: ${e instanceof Error ? e.message : String(e)}`
              }
            ]
          },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    if (!functionParams) {
      return NextResponse.json(
        {
          results: [
            {
              toolCallId,
              error: 'Missing function parameters'
            }
          ]
        },
        { status: 400 }
      );
    }
    
    const { startDate, endDate } = functionParams;
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        {
          results: [
            {
              toolCallId,
              error: 'Missing required parameters: startDate and endDate are required'
            }
          ]
        },
        { status: 400 }
      );
    }

    // Parse dates from the input parameters
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    if (Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime())) {
      return NextResponse.json(
        {
          results: [
            {
              toolCallId,
              error: 'Invalid date format provided'
            }
          ]
        },
        { status: 400 }
      );
    }

    console.log(`Checking availability from ${startDateObj.toISOString()} to ${endDateObj.toISOString()}`);
    
    // Query the database for booked appointments in the date range
    const bookedAppointments = await prisma.appointment.findMany({
      where: {
        date: {
          gte: startDateObj,
          lte: endDateObj
        },
        status: {
          in: ['SCHEDULED', 'CONFIRMED']
        }
      },
      select: {
        date: true
      }
    });
    
    // Get the booked times as ISO strings for easy comparison
    const bookedTimes = bookedAppointments.map(appointment => 
      appointment.date.toISOString()
    );
    
    // Generate all possible slots in the date range
    const allSlots = generateAvailableSlots(startDateObj, endDateObj);
    
    // Filter out the booked slots
    const availableSlots = allSlots.filter(slot => 
      !bookedTimes.includes(new Date(slot).toISOString())
    );
    
    console.log(`Found ${availableSlots.length} available slots out of ${allSlots.length} total slots`);
    
    // Format the response
    const formattedSlots = availableSlots.map(slot => {
      const slotDate = new Date(slot);
      return slotDate.toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true // Use AM/PM
      });
    });
    
    // Build a response message based on availability
    let responseMessage: string;
    
    if (availableSlots.length === 0) {
      responseMessage = `I'm sorry, but we don't have any available appointment slots between ${startDate} and ${endDate}. Please try a different date range.`;
    } else if (availableSlots.length <= 5) {
      // If only a few slots, list them specifically
      responseMessage = `We have the following appointment slots available between ${startDate} and ${endDate}: ${formattedSlots.join(', ')}. Would you like to book one of these times?`;
    } else {
      // If many slots, summarize by days
      const daysAvailable = [...new Set(availableSlots.map(slot => slot.split('T')[0]))].length;
      responseMessage = `We have ${availableSlots.length} appointment slots available across ${daysAvailable} days between ${startDate} and ${endDate}. Some available times include: ${formattedSlots.slice(0, 3).join(', ')}. What day and time would work best for you?`;
    }
    
    // Return the response in the format expected by VAPI
    return NextResponse.json({
      results: [
        {
          toolCallId,
          result: responseMessage
        }
      ]
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    return NextResponse.json(
      {
        results: [
          {
            error: `Failed to check availability: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Add the OPTIONS handler for CORS
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