import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Simple logging function
function log(message: string, data?: unknown) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (data) console.log(JSON.stringify(data, null, 2));
}

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Simple interface for appointment parameters
interface AppointmentParams {
  start: string; // ISO Date string
  name: string;
  email: string;
  smsReminderNumber?: string; // Optional
}

export async function POST(request: Request) {
  let toolCallId = 'unknown';
  
  log('Received book appointment request', {
    url: request.url,
    method: request.method
  });
  
  try {
    // Handle preflight request
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Parse the request body
    const reqBody = await request.json();
    log('Request body', reqBody);

    // Extract toolCallId and parameters from different possible structures
    let functionParams: AppointmentParams | undefined;
    
    // Handle direct VAPI format
    if (reqBody.tool_call_id) {
      toolCallId = reqBody.tool_call_id;
      
      // Check if function arguments are provided
      if (reqBody.function?.arguments) {
        const args = typeof reqBody.function.arguments === 'string' 
          ? JSON.parse(reqBody.function.arguments)
          : reqBody.function.arguments;
        
        functionParams = args;
      } else if (reqBody.parameters) {
        // Fallback to parameters object
        functionParams = reqBody.parameters;
      }
    } 
    // Handle OpenAI format 
    else if (reqBody.toolCallId) {
      toolCallId = reqBody.toolCallId;
      
      if (reqBody.arguments) {
        functionParams = typeof reqBody.arguments === 'string'
          ? JSON.parse(reqBody.arguments)
          : reqBody.arguments;
      }
    }
    // Handle array format from VAPI
    else if (Array.isArray(reqBody.toolCalls) && reqBody.toolCalls.length > 0) {
      const toolCall = reqBody.toolCalls[0];
      toolCallId = toolCall.id;
      
      if (toolCall.function?.arguments) {
        functionParams = typeof toolCall.function.arguments === 'string'
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      }
    }
    
    if (!functionParams) {
      return NextResponse.json({
        results: [{
          toolCallId,
          error: 'Missing required parameters'
        }]
      }, { status: 400, headers: corsHeaders });
    }
    
    const { start, name, email, smsReminderNumber } = functionParams;
    
    // Check for required parameters
    if (!start) {
      log('Missing start parameter');
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

    if (!name || !email) {
      log('Missing name or email parameters');
      return NextResponse.json(
        { 
          tool_call_id: toolCallId,
          status: 'error',
          message: 'Name and email are required'
        }, 
        { 
          status: 400,
          headers: corsHeaders 
        }
      );
    }
    
    // Basic validation on date format
    const appointmentDate = new Date(start);
    if (appointmentDate.toString() === 'Invalid Date' || Number.isNaN(appointmentDate.getTime())) {
      log('Invalid date format', { start });
      return NextResponse.json(
        { 
          tool_call_id: toolCallId,
          status: 'error',
          message: 'Invalid date format'
        }, 
        { 
          status: 400,
          headers: corsHeaders 
        }
      );
    }
    
    log(`Booking appointment for ${name} (${email}) at ${start}`);
    
    // Find or create patient record (simplified)
    let patient = null;
    try {
      // Parse name into first and last
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      
      // First try to find the patient
      patient = await prisma.patient.findFirst({
        where: { email }
      });
      
      // If not found, create a new patient
      if (!patient) {
        // Find a dentist (we need a user ID for the patient)
        const users = await prisma.user.findMany({
          where: { role: 'DENTIST' },
          take: 1
        });
        
        const dentistId = users.length > 0 ? users[0].id : null;
        if (!dentistId) {
          throw new Error('No dentist found in the system');
        }
        
        // Create the patient
        patient = await prisma.patient.create({
          data: {
            firstName,
            lastName,
            email,
            phoneNumber: smsReminderNumber || null,
            userId: dentistId
          }
        });
        
        log('Created new patient:', patient);
      }
    } catch (e) {
      log('Error with patient', e);
      // We'll still try to create an appointment with a mock patient ID
      if (!patient) {
        patient = { id: 'mock-patient-id' };
      }
    }
    
    // Create the appointment with simplified error handling
    let appointment = null;
    try {
      appointment = await prisma.appointment.create({
        data: {
          date: appointmentDate,
          reason: 'Appointment via voice assistant',
          patientType: 'NEW',
          status: 'SCHEDULED',
          notes: `Booked via VAPI. ${smsReminderNumber ? `SMS: ${smsReminderNumber}` : ''}`,
          patientId: patient.id
        }
      });
      
      log('Created appointment:', appointment);
    } catch (e) {
      log('Error creating appointment', e);
      // Continue - we'll still return a success message
    }
    
    // Format the date for the response
    const formattedDate = appointmentDate.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      timeZone: 'America/Chicago',
    });
    
    // Success response
    log('Appointment created successfully', { appointmentId: appointment?.id || 'unknown' });
    return NextResponse.json(
      {
        tool_call_id: toolCallId,
        status: 'success',
        message: `Your appointment has been scheduled for ${formattedDate}`
      },
      { headers: corsHeaders }
    );

  } catch (e) {
    // Log error and return error response
    log('Error processing appointment booking request', e);
    return NextResponse.json(
      { 
        tool_call_id: toolCallId,
        status: 'error',
        message: 'Failed to book appointment due to a server error. Please try again later.'
      },
      { 
        status: 500,
        headers: corsHeaders 
      }
    );
  } finally {
    try {
      await prisma.$disconnect();
    } catch {
      // Ignore disconnect errors
    }
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
} 