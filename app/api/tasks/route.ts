import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Role, TaskStatus } from '@prisma/client';

// Define types for the where clause that match Prisma's expected types
interface TaskWhereInput {
  status?: TaskStatus;
  assignedToId?: string;
  assignedRole?: Role | null;
  callId?: string;
  organizationId?: string;
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as TaskStatus | null;
    const assignedToId = searchParams.get('assignedToId');
    const assignedRole = searchParams.get('assignedRole') as Role | null;
    const callId = searchParams.get('callId');
    const organizationId = searchParams.get('organizationId');

    // Build where clause based on filters
    const where: TaskWhereInput = {};
    
    if (status) where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;
    if (assignedRole) where.assignedRole = assignedRole;
    if (callId) where.callId = callId;
    if (organizationId) where.organizationId = organizationId;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignedTo: true,
        appointment: {
          include: {
            patient: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' }, // High priority first
        { createdAt: 'desc' }, // Then newest first
      ],
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.description || !body.organizationId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        description: body.description,
        priority: body.priority || 'MEDIUM',
        status: body.status || 'PENDING',
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        assignedToId: body.assignedToId || null,
        assignedRole: body.assignedRole || null,
        callId: body.callId || null,
        appointmentId: body.appointmentId || null,
        organizationId: body.organizationId,
      },
      include: {
        assignedTo: true,
        appointment: {
          include: {
            patient: true,
          },
        },
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    
    if (isPrismaError(error) && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A task with these details already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
} 