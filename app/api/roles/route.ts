import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

// Interface for Prisma error with a code property
interface PrismaError {
  code: string;
  meta?: Record<string, unknown>;
  message: string;
}

// Type guard to check if an error is a Prisma error
function isPrismaError(error: unknown): error is PrismaError {
  return (
    typeof error === 'object' && 
    error !== null && 
    'code' in error && 
    typeof (error as { code: unknown }).code === 'string'
  );
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const roleResponsibilities = await prisma.roleResponsibility.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        role: 'asc',
      },
    });

    return NextResponse.json(roleResponsibilities);
  } catch (error) {
    console.error('Error fetching role responsibilities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch role responsibilities' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.role || !body.description || !body.organizationId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check that role is valid
    const validRoles = Object.values(Role);
    if (!validRoles.includes(body.role)) {
      return NextResponse.json(
        { error: 'Invalid role value' },
        { status: 400 }
      );
    }

    const roleResponsibility = await prisma.roleResponsibility.create({
      data: {
        role: body.role,
        description: body.description,
        organizationId: body.organizationId,
      },
    });

    return NextResponse.json(roleResponsibility);
  } catch (error) {
    console.error('Error creating role responsibility:', error);
    
    // Handle unique constraint violation
    if (isPrismaError(error) && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A responsibility for this role already exists in this organization' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create role responsibility' },
      { status: 500 }
    );
  }
} 