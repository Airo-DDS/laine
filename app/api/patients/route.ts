import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const patients = await prisma.patient.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        appointments: {
          select: {
            id: true,
            date: true,
            status: true,
          },
          orderBy: {
            date: 'desc',
          },
          take: 5,
        },
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