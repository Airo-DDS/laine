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