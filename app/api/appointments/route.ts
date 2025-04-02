import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

    // Create new appointment
    const appointment = await prisma.appointment.create({
      data: {
        date: new Date(date),
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
    return NextResponse.json({ error: 'Failed to create appointment' }, { status: 500 });
  }
} 