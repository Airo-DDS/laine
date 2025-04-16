import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Role, TaskPriority } from '@prisma/client';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

// Define the schema for task generation
const TaskSchema = z.object({
  description: z.string().min(5).describe("Clear, concise description of the task."),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).describe("Estimated task priority."),
  assignedRole: z.enum([
    "ADMIN",
    "DENTIST", 
    "RECEPTIONIST", 
    "OFFICE_MANAGER", 
    "BILLING_SPECIALIST"
  ]).nullable().describe("The role best suited for this task based on responsibilities, or null if unsure.")
});

const TaskListSchema = z.object({
  tasks: z.array(TaskSchema).describe("List of generated tasks.")
});

// Task type for the generated tasks
type GeneratedTask = {
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assignedRole: Role | null;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.organizationId || !body.callId || !body.summary || !body.transcript) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Fetch role responsibilities for the organization
    const roleResponsibilities = await prisma.roleResponsibility.findMany({
      where: {
        organizationId: body.organizationId,
      },
    });

    // Format role responsibilities for the prompt
    const roleDescriptions = roleResponsibilities.map(resp => 
      `ROLE: ${resp.role}, RESPONSIBILITIES: ${resp.description}`
    ).join('\n');
    
    // Construct the prompt
    const prompt = `
You are an AI assistant for a dental practice. Your job is to analyze call data and generate appropriate follow-up tasks.

CALL SUMMARY:
${body.summary}

CALL TRANSCRIPT:
${body.transcript}

${body.structuredData ? `STRUCTURED DATA FROM CALL:\n${JSON.stringify(body.structuredData, null, 2)}\n` : ''}

ROLE RESPONSIBILITIES IN THE DENTAL PRACTICE:
${roleDescriptions}

Based on the call information above and the defined role responsibilities, generate a list of necessary follow-up tasks. 
For each task, provide a clear description, suggest a priority (LOW, MEDIUM, HIGH, URGENT), and assign it to the most appropriate role based on the responsibilities.
Only create tasks that are necessary and relevant to the call content.
If no specific role fits for a task, assign null.
`;

    // Generate tasks using OpenAI
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: TaskListSchema,
      prompt,
    });

    // Save generated tasks to database
    const createdTasks = await Promise.all(
      object.tasks.map((task: GeneratedTask) => 
        prisma.task.create({
          data: {
            description: task.description,
            priority: task.priority as TaskPriority,
            assignedRole: task.assignedRole as Role | null,
            callId: body.callId,
            organizationId: body.organizationId,
            // Connect to appointment if provided
            appointmentId: body.appointmentId || null,
          },
          include: {
            assignedTo: true,
            appointment: {
              include: {
                patient: true,
              },
            },
          },
        })
      )
    );

    return NextResponse.json(createdTasks);
  } catch (error) {
    console.error('Error generating tasks:', error);
    return NextResponse.json(
      { error: 'Failed to generate tasks' },
      { status: 500 }
    );
  }
} 