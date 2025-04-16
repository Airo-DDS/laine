import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

// Define params as a Promise type for Next.js 15
type ParamsPromise = Promise<{ responsibilityId: string }>;

interface UpdateRoleData {
  description: string;
  role?: Role;
}

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

export async function PUT(
  request: NextRequest,
  { params }: { params: ParamsPromise }
) {
  try {
    // Get the responsibilityId by awaiting the params promise
    const { responsibilityId } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    // Update role if provided and validate
    const updateData: UpdateRoleData = {
      description: body.description,
    };

    if (body.role) {
      const validRoles = Object.values(Role);
      if (!validRoles.includes(body.role)) {
        return NextResponse.json(
          { error: 'Invalid role value' },
          { status: 400 }
        );
      }
      updateData.role = body.role;
    }

    const roleResponsibility = await prisma.roleResponsibility.update({
      where: { id: responsibilityId },
      data: updateData,
    });

    return NextResponse.json(roleResponsibility);
  } catch (error) {
    console.error('Error updating role responsibility:', error);
    
    // Handle unique constraint violation
    if (isPrismaError(error) && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A responsibility for this role already exists in this organization' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update role responsibility' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: ParamsPromise }
) {
  try {
    // Get the responsibilityId by awaiting the params promise
    const { responsibilityId } = await params;

    await prisma.roleResponsibility.delete({
      where: { id: responsibilityId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting role responsibility:', error);
    return NextResponse.json(
      { error: 'Failed to delete role responsibility' },
      { status: 500 }
    );
  }
} 