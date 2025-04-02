import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PrismaClient } from '@prisma/client'

const prismaClient = new PrismaClient()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    
    // Set up filter
    const filter = role ? { role } : {}
    
    const users = await prismaClient.user.findMany({
      where: filter,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: {
        name: 'asc',
      },
    })
    
    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, role } = body
    
    const user = await prisma.user.create({
      data: {
        name,
        email,
        role: role || 'USER',
      },
    })
    
    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
} 