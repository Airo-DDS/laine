import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// Define params as a Promise type for Next.js 15
type ParamsPromise = Promise<{ taskId: string }>;

export async function PUT(
  request: NextRequest,
  { params }: { params: ParamsPromise }
) {
  try {
    // Get the taskId by awaiting the params promise
    const { taskId } = await params;
    const body = await request.json();

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        description: body.description,
        status: body.status,
        priority: body.priority,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        assignedToId: body.assignedToId,
        assignedRole: body.assignedRole,
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
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: ParamsPromise }
) {
  try {
    // Get the taskId by awaiting the params promise
    const { taskId } = await params;

    await prisma.task.delete({
      where: { id: taskId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
} 