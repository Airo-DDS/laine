import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define standard appointment slots (30 minutes each, from 9am to 5pm Central Time)
const APPOINTMENT_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', 
  '15:00', '15:30', '16:00', '16:30', '17:00'
];

// Helper function to convert UTC to Central Time (America/Chicago)
function convertToCentralTime(date: Date): Date {
  // Create a string representation in America/Chicago timezone
  const centralTimeStr = new Date(date).toLocaleString('en-US', {
    timeZone: 'America/Chicago'
  });
  
  // Parse this back to a Date object (in local time)
  return new Date(centralTimeStr);
}

// Check if a date is a business day (Monday-Friday)
function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 0 = Sunday, 6 = Saturday
}

// Validate if the appointment time is within business hours (Central Time)
function isValidAppointmentTime(dateTime: Date): { valid: boolean; message?: string } {
  // Convert UTC input to Central Time
  const centralTime = convertToCentralTime(dateTime);
  
  // Check if it's a business day in Central Time
  if (!isBusinessDay(centralTime)) {
    return { 
      valid: false, 
      message: 'Appointments can only be scheduled Monday through Friday in Central Time (CT).'
    };
  }
  
  // Format the Central Time to check against allowed slots
  const hours = centralTime.getHours().toString().padStart(2, '0');
  const minutes = centralTime.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  
  console.log(`Validating appointment time in Central Time: ${timeStr} against allowed slots:`, APPOINTMENT_SLOTS);
  
  // Check if the Central Time matches an allowed slot
  if (!APPOINTMENT_SLOTS.includes(timeStr)) {
    return { 
      valid: false, 
      message: `Appointments can only be scheduled between 9:00 AM and 5:00 PM Central Time (CT) in 30-minute intervals. Received: ${timeStr} CT`
    };
  }
  
  return { valid: true };
}

// GET all appointments with patient details
export async function GET() {
  try {
    const appointments = await prisma.appointment.findMany({
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    return NextResponse.json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 });
  }
}

// POST new appointment
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, patientId, reason, patientType, notes } = body;

    // Validate required fields
    if (!date || !patientId || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: date, patientId, and reason are required' },
        { status: 400 }
      );
    }

    // Parse the appointment date
    const appointmentDate = new Date(date);
    
    // Validate that the appointment time is within business hours
    const timeValidation = isValidAppointmentTime(appointmentDate);
    if (!timeValidation.valid) {
      console.error('Appointment validation failed:', timeValidation.message);
      return NextResponse.json(
        { error: timeValidation.message },
        { status: 400 }
      );
    }

    // Create new appointment
    const appointment = await prisma.appointment.create({
      data: {
        date: appointmentDate,
        patientId,
        reason,
        patientType: patientType || 'EXISTING',
        notes: notes || '',
        status: 'SCHEDULED',
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json(appointment);
  } catch (error) {
    console.error('Error creating appointment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Detailed error:', errorMessage);
    return NextResponse.json({ error: `Failed to create appointment: ${errorMessage}` }, { status: 500 });
  }
} 