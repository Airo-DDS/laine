import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

// Validate if the appointment time is within business hours
function isValidAppointmentTime(dateTime: Date): { valid: boolean; message?: string } {
  // Check if it's a business day
  if (!isBusinessDay(dateTime)) {
    return { 
      valid: false, 
      message: 'Appointments can only be scheduled Monday through Friday.'
    };
  }
  
  // Format the time part to check against allowed slots
  const hours = dateTime.getUTCHours().toString().padStart(2, '0');
  const minutes = dateTime.getUTCMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  
  // Check if the time matches an allowed slot
  if (!APPOINTMENT_SLOTS.includes(timeStr)) {
    return { 
      valid: false, 
      message: 'Appointments can only be scheduled between 9:00 AM and 5:00 PM in 30-minute intervals.'
    };
  }
  
  return { valid: true };
}

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

interface AppointmentParams {
  start: string; // ISO Date string
  name: string;
  email: string;
  smsReminderNumber?: string; // Optional
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
    let functionParams: AppointmentParams | undefined;
    
    // Handle both old and new VAPI webhook formats
    if (body.message?.toolCallList && body.message.toolCallList.length > 0) {
      // New format
      const toolCall = body.message.toolCallList[0];
      toolCallId = toolCall.id;
      
      if (toolCall.function?.name !== 'bookAppointment') {
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
        functionParams = JSON.parse(toolCall.function.arguments);
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
      
      if (body.message.functionCall.name !== 'bookAppointment') {
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
        functionParams = JSON.parse(body.message.functionCall.parameters);
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
    
    const { start, name, email, smsReminderNumber } = functionParams;

    console.log(`Booking appointment for ${name} (${email}) at ${start}, toolCallId: ${toolCallId}`);
    
    if (!start || !name || !email) {
      return NextResponse.json(
        {
          results: [
            {
              toolCallId,
              error: 'Missing required parameters: start, name, and email are required'
            }
          ]
        },
        { status: 400 }
      );
    }

    if (smsReminderNumber) {
      console.log(`SMS reminder will be sent to ${smsReminderNumber}`);
    }

    // Parse the appointment start time
    const appointmentDate = new Date(start);
    
    // Validate that the appointment time is within business hours
    const timeValidation = isValidAppointmentTime(appointmentDate);
    if (!timeValidation.valid) {
      return NextResponse.json(
        {
          results: [
            {
              toolCallId,
              error: timeValidation.message
            }
          ]
        },
        { status: 400 }
      );
    }
    
    // Check if the time slot is already booked
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        date: appointmentDate,
        status: {
          in: ['SCHEDULED', 'CONFIRMED']
        }
      }
    });

    if (existingAppointment) {
      return NextResponse.json(
        {
          results: [
            {
              toolCallId,
              error: 'This time slot is already booked. Please choose another time.'
            }
          ]
        },
        { status: 409 }
      );
    }
    
    // Find or create the patient based on email
    let patient = await prisma.patient.findFirst({
      where: {
        email
      }
    });
    
    // If patient doesn't exist, create a new one
    if (!patient) {
      const users = await prisma.user.findMany({
        where: {
          role: 'DENTIST'
        },
        take: 1
      });
      
      const dentistId = users.length > 0 ? users[0].id : null;
      
      if (!dentistId) {
        return NextResponse.json(
          {
            results: [
              {
                toolCallId,
                error: 'No dentist found in the system. Cannot create patient.'
              }
            ]
          },
          { status: 500 }
        );
      }
      
      // Parse the name into first and last name
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      
      patient = await prisma.patient.create({
        data: {
          firstName,
          lastName,
          email,
          phoneNumber: smsReminderNumber || null,
          userId: dentistId
        }
      });
      
      console.log(`Created new patient: ${patient.firstName} ${patient.lastName}`);
    }

    // Create the appointment
    const appointment = await prisma.appointment.create({
      data: {
        date: appointmentDate,
        reason: 'Appointment via voice assistant',
        patientType: patient ? 'EXISTING' : 'NEW',
        status: 'SCHEDULED',
        notes: `Booked via voice assistant. ${smsReminderNumber ? `SMS reminder: ${smsReminderNumber}` : ''}`,
        patientId: patient.id
      }
    });
    
    console.log(`Created appointment with ID: ${appointment.id}`);

    // Format the date for the response message
    const formattedDate = appointmentDate.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Prepare a user-friendly response message
    const successMessage = `Appointment successfully booked for ${name} on ${formattedDate}. We've sent a confirmation email to ${email}${smsReminderNumber ? ` and an SMS to ${smsReminderNumber}` : ''}.`;
    
    // Return the response in the format expected by VAPI
    return NextResponse.json({
      results: [
        {
          toolCallId,
          result: successMessage
        }
      ]
    });
  } catch (error) {
    console.error('Error booking appointment:', error);
    return NextResponse.json(
      {
        results: [
          {
            error: `Failed to book appointment: ${error instanceof Error ? error.message : String(error)}`
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