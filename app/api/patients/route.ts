import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET all patients
export async function GET() {
  try {
    const patients = await prisma.patient.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
      },
      orderBy: {
        lastName: 'asc',
      },
    })
    
    return NextResponse.json(patients)
  } catch (error) {
    console.error('Error fetching patients:', error)
    return NextResponse.json(
      { error: 'Failed to fetch patients' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { firstName, lastName, email, phoneNumber, dateOfBirth, userId } = body
    
    const patient = await prisma.patient.create({
      data: {
        firstName,
        lastName,
        email,
        phoneNumber,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        userId,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })
    
    return NextResponse.json(patient, { status: 201 })
  } catch (error) {
    console.error('Error creating patient:', error)
    return NextResponse.json(
      { error: 'Failed to create patient' },
      { status: 500 }
    )
  }
} 