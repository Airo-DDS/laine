import { NextResponse } from 'next/server';
import { PrismaClient, PatientType, Role } from '@prisma/client'; // Keep value imports
import type { Patient, Appointment } from '@prisma/client'; // Use type imports for types

const prisma = new PrismaClient();

// --- Configuration & Constants ---
const DEFAULT_APPOINTMENT_REASON = "Appointment via voice assistant";
const DEFAULT_TIMEZONE = 'America/Chicago'; // Or pull from env var if needed

// --- Logging Utility ---
function log(message: string, data?: unknown) {
  console.log(`[${new Date().toISOString()}] [book-appointment] ${message}`);
  if (data) {
    // Avoid logging potentially sensitive full request bodies in production if necessary
    // Consider redacting sensitive fields if logging the full body
    console.log(JSON.stringify(data, null, 2));
  }
}

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Adjust in production
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// --- Interfaces ---
interface AppointmentParams {
  start: string; // Expect ISO 8601 string
  name: string;
  email: string;
  smsReminderNumber?: string;
}

interface VapiToolCall {
    id: string;
    function?: {
        name?: string;
        arguments?: string | Record<string, unknown>;
    };
}

interface RequestBody {
    message?: { toolCalls?: VapiToolCall[]; toolCallList?: VapiToolCall[] };
    tool_call_id?: string;
    parameters?: Record<string, unknown>; // Direct Vapi format
    toolCallId?: string; // OpenAI format
    arguments?: string | Record<string, unknown>; // OpenAI format
    toolCalls?: VapiToolCall[]; // Vapi array format
}

// --- Helper Functions ---

// Standardized Vapi Response
function createVapiResponse(toolCallId: string, result?: string, error?: string, status = 200) {
  const payload = {
    results: [{
      toolCallId,
      ...(result && { result }), // Conditionally add result
      ...(error && { error }),   // Conditionally add error
    }]
  };
  return NextResponse.json(payload, { status, headers: corsHeaders });
}

// Parse Name
function parseFullName(fullName: string): { firstName: string; lastName: string } {
  const nameParts = fullName.trim().split(' ');
  const firstName = nameParts[0] || 'Unknown'; // Default if empty
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Patient'; // Default if only one name part
  return { firstName, lastName };
}

// Format Date for Confirmation Message
function formatConfirmationDate(date: Date): string {
   return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
      timeZone: DEFAULT_TIMEZONE, // Use configured timezone
    });
}


// --- Main API Route Handler ---
export async function POST(request: Request) {
  let toolCallId = 'unknown-tool-call-id'; // Default ID if extraction fails
  log('Received request');

  try {
    // Handle CORS preflight request
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: corsHeaders });
    }

    // --- Parameter Extraction ---
    const reqBody: RequestBody = await request.json();
    log('Request body received'); // Avoid logging full body in prod if sensitive

    let functionParams: AppointmentParams | undefined;
    let rawArgs: string | Record<string, unknown> | undefined;

    // Extract toolCallId and arguments from various possible structures
    if (reqBody.message?.toolCalls?.[0]?.id) {
        toolCallId = reqBody.message.toolCalls[0].id;
        rawArgs = reqBody.message.toolCalls[0].function?.arguments;
    } else if (reqBody.message?.toolCallList?.[0]?.id) {
        toolCallId = reqBody.message.toolCallList[0].id;
        rawArgs = reqBody.message.toolCallList[0].function?.arguments;
    } else if (reqBody.tool_call_id) {
        toolCallId = reqBody.tool_call_id;
        rawArgs = reqBody.parameters; // Assume parameters are the arguments
    } else if (reqBody.toolCallId) {
        toolCallId = reqBody.toolCallId;
        rawArgs = reqBody.arguments;
    } else if (Array.isArray(reqBody.toolCalls) && reqBody.toolCalls.length > 0) {
        toolCallId = reqBody.toolCalls[0].id;
        rawArgs = reqBody.toolCalls[0].function?.arguments;
    }

    // Parse arguments if they are a string
    if (typeof rawArgs === 'string') {
        try {
            const parsedArgs = JSON.parse(rawArgs);
            // Additional check after parsing
            if (parsedArgs && typeof parsedArgs === 'object' &&
                'start' in parsedArgs && typeof parsedArgs.start === 'string' &&
                'name' in parsedArgs && typeof parsedArgs.name === 'string' &&
                'email' in parsedArgs && typeof parsedArgs.email === 'string') {
                functionParams = {
                    start: parsedArgs.start,
                    name: parsedArgs.name,
                    email: parsedArgs.email,
                    smsReminderNumber: typeof parsedArgs.smsReminderNumber === 'string' ? parsedArgs.smsReminderNumber : undefined
                };
            } else {
                 log('Error: Parsed stringified arguments are missing required fields or have incorrect types', { parsedArgs });
                 return createVapiResponse(toolCallId, undefined, 'Could not understand the provided appointment details (invalid format).', 400);
            }
        } catch (parseError) {
            log('Error parsing stringified arguments', { rawArgs, error: parseError });
            return createVapiResponse(toolCallId, undefined, 'Could not understand the provided appointment details.', 400);
        }
    } else if (typeof rawArgs === 'object' && rawArgs !== null) {
        // Type guard to ensure rawArgs has the required properties
        if ('start' in rawArgs && typeof rawArgs.start === 'string' &&
            'name' in rawArgs && typeof rawArgs.name === 'string' &&
            'email' in rawArgs && typeof rawArgs.email === 'string') {
            // Create a new object matching the interface instead of asserting
            functionParams = {
                start: rawArgs.start,
                name: rawArgs.name,
                email: rawArgs.email,
                smsReminderNumber: 'smsReminderNumber' in rawArgs && typeof rawArgs.smsReminderNumber === 'string'
                    ? rawArgs.smsReminderNumber
                    : undefined
            };
        } else {
            log('Error: Received object arguments are missing required fields or have incorrect types', { rawArgs });
            return createVapiResponse(toolCallId, undefined, 'Could not understand the provided appointment details (invalid format).', 400);
        }
    }

    log('Extracted parameters', { toolCallId, functionParams: functionParams ? 'extracted' : 'not found' });

    if (!functionParams) {
      log('Error: Missing function parameters in request body');
      return createVapiResponse(toolCallId, undefined, 'Missing required appointment parameters.', 400);
    }

    const { start, name, email, smsReminderNumber } = functionParams;

    // --- Input Validation ---
    if (!start || !name || !email) {
      log('Error: Missing required fields', { start: !!start, name: !!name, email: !!email });
      return createVapiResponse(toolCallId, undefined, 'Start date, patient name, and email are required.', 400);
    }

    const appointmentDate = new Date(start);
    if (Number.isNaN(appointmentDate.getTime())) { // Use Number.isNaN
      log('Error: Invalid date format received', { start });
      return createVapiResponse(toolCallId, undefined, `Invalid date format: ${start}. Please use ISO 8601 format.`, 400);
    }

    // Optional: Add validation for email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        log('Error: Invalid email format', { email });
        return createVapiResponse(toolCallId, undefined, `Invalid email format provided: ${email}.`, 400);
    }

    log(`Processing booking for: ${name} (${email}) at ${appointmentDate.toISOString()}`);

    // --- Find or Create Patient ---
    let patient: Patient | null = null;
    let patientWasCreated = false;
    const { firstName, lastName } = parseFullName(name);

    try {
      patient = await prisma.patient.findUnique({ where: { email } });

      if (!patient) {
        log(`Patient with email ${email} not found. Creating new patient.`);
        const dentist = await prisma.user.findFirst({ where: { role: Role.DENTIST } }); // Use imported Enum
        if (!dentist) {
          log('CRITICAL Error: No DENTIST user found in the database.');
          return createVapiResponse(toolCallId, undefined, 'Internal setup error. Cannot schedule appointment.', 500);
        }

        patient = await prisma.patient.create({
          data: {
            firstName,
            lastName,
            email,
            phoneNumber: smsReminderNumber || null,
            userId: dentist.id,
          },
        });
        patientWasCreated = true;
        log('New patient created successfully', { patientId: patient.id });
      } else {
        log('Existing patient found', { patientId: patient.id });
        if (smsReminderNumber && patient.phoneNumber !== smsReminderNumber) {
           await prisma.patient.update({
             where: { id: patient.id },
             data: { phoneNumber: smsReminderNumber },
           });
           log(`Updated phone number for existing patient ${patient.id}`);
        }
      }
    } catch (dbError) {
      log('Database error during patient find/create', dbError);
      return createVapiResponse(toolCallId, undefined, 'There was an issue accessing patient records.', 500);
    }

    // --- Create Appointment ---
    let newAppointment: Appointment | null = null;
    try {
      // Ensure patient is not null before proceeding
      if (!patient) {
           log('CRITICAL Error: Patient record is unexpectedly null before appointment creation.');
           return createVapiResponse(toolCallId, undefined, 'Internal server error processing patient data.', 500);
      }

      newAppointment = await prisma.appointment.create({
        data: {
          date: appointmentDate,
          reason: DEFAULT_APPOINTMENT_REASON,
          patientType: patientWasCreated ? PatientType.NEW : PatientType.EXISTING,
          status: 'SCHEDULED',
          notes: `Booked via VAPI Tool.${smsReminderNumber ? ` SMS Reminder #: ${smsReminderNumber}` : ''}`,
          patientId: patient.id,
        },
      });
      log('Appointment created successfully in DB', { appointmentId: newAppointment.id });
    } catch (dbError: unknown) {
        log('Database error during appointment creation', dbError);
        // Check for specific Prisma errors, like unique constraint violation if needed
        // Example: if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') { ... }

        // Attempt rollback if a new patient was created
        if (patientWasCreated && patient?.id) {
            log(`Attempting to rollback patient creation for ${patient.id}`);
            await prisma.patient.delete({ where: { id: patient.id } }).catch(rollbackError => {
                log(`CRITICAL: Failed to rollback patient creation for ${patient.id}`, rollbackError);
                // Decide how to handle this - maybe log prominently
            });
        }
        return createVapiResponse(toolCallId, undefined, 'Failed to save the appointment in the schedule. Please try again.', 500);
    }

    // --- Format Confirmation & Return Success ---
    const formattedDate = formatConfirmationDate(appointmentDate);
    const confirmationMessage = `Okay, I've booked the appointment for ${name} on ${formattedDate}.`;
    log('Sending success response', { confirmationMessage });

    return createVapiResponse(toolCallId, confirmationMessage);

  } catch (error) {
    log('Unhandled error in POST handler', error);
    const message = error instanceof Error ? error.message : 'An unknown server error occurred.';
    // Ensure a Vapi-compatible error format even for unexpected errors
    return createVapiResponse(toolCallId, undefined, `Booking failed due to an unexpected error: ${message}`, 500);
  } finally {
    await prisma.$disconnect().catch(e => log('Error disconnecting Prisma', e));
  }
}

// Handle CORS preflight OPTIONS request
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}