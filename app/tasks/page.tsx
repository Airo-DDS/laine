'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Role, TaskPriority, TaskStatus } from '@prisma/client';

// Type definitions for our data
interface CallLog {
  id: string;
  date: string;
  summary: string;
  transcript: string;
  structuredData?: Record<string, unknown>;
}

interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedRole: Role | null;
  createdAt: string;
  dueDate: string | null;
  appointmentId: string | null;
  appointment?: {
    id: string;
    date: string;
    patient: {
      firstName: string;
      lastName: string;
    };
  };
}

const priorityColors = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-amber-100 text-amber-800',
  URGENT: 'bg-red-100 text-red-800',
};

const roleColors = {
  ADMIN: 'bg-purple-100 text-purple-800',
  DENTIST: 'bg-green-100 text-green-800',
  RECEPTIONIST: 'bg-blue-100 text-blue-800',
  OFFICE_MANAGER: 'bg-amber-100 text-amber-800',
  BILLING_SPECIALIST: 'bg-teal-100 text-teal-800',
};

export default function TasksPage() {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  
  const [isLoadingCalls, setIsLoadingCalls] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch organization ID (for demo, we'll just use the first one)
  useEffect(() => {
    async function fetchOrganization() {
      try {
        const response = await fetch('/api/organizations');
        const data = await response.json();
        if (data && data.length > 0) {
          setOrganizationId(data[0].id);
        }
      } catch (error) {
        console.error('Error fetching organization:', error);
        // For demo, set a fallback organization ID from the seed data
        setOrganizationId('cm9k9kz7q00004vn62n2qarnj');
      }
    }
    fetchOrganization();
  }, []);

  // Fetch recent calls
  useEffect(() => {
    async function fetchCalls() {
      setIsLoadingCalls(true);
      try {
        const response = await fetch('/api/call-logs?limit=10');
        const data = await response.json();
        setCalls(data);
      } catch (error) {
        console.error('Error fetching calls:', error);
        setError('Failed to load recent calls');
      } finally {
        setIsLoadingCalls(false);
      }
    }
    fetchCalls();
  }, []);

  // Fetch tasks for the selected call
  useEffect(() => {
    if (selectedCallId) {
      setIsLoadingTasks(true);
      fetch(`/api/tasks?callId=${selectedCallId}`)
        .then(response => response.json())
        .then(data => {
          setTasks(data);
          // Find and set the selected call details
          const call = calls.find(c => c.id === selectedCallId);
          if (call) setSelectedCall(call);
        })
        .catch(error => {
          console.error('Error fetching tasks:', error);
          setError('Failed to load tasks for this call');
        })
        .finally(() => {
          setIsLoadingTasks(false);
        });
    } else {
      setTasks([]);
      setSelectedCall(null);
    }
  }, [selectedCallId, calls]);

  const handleCallSelect = (callId: string) => {
    setSelectedCallId(callId);
  };

  const handleGenerateTasks = async () => {
    if (!selectedCall || !organizationId) return;

    setIsGeneratingTasks(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callId: selectedCall.id,
          summary: selectedCall.summary,
          transcript: selectedCall.transcript,
          structuredData: selectedCall.structuredData,
          organizationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate tasks');
      }

      const generatedTasks = await response.json();
      setTasks(prevTasks => [...generatedTasks, ...prevTasks]);
    } catch (error) {
      console.error('Error generating tasks:', error);
      setError('Failed to generate tasks. Please try again.');
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row w-full gap-6 p-6">
      {/* Column 1: Recent Calls */}
      <div className="w-full lg:w-1/3 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {isLoadingCalls ? (
                // Loading state for calls
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={`call-skeleton-${i}`} className="mb-4">
                    <Skeleton className="h-6 w-1/3 mb-2" />
                    <Skeleton className="h-4 w-full mb-1" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ))
              ) : calls.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No recent calls found</p>
              ) : (
                <div className="space-y-4">
                  {calls.map(call => (
                    <Card 
                      key={call.id} 
                      className={`cursor-pointer hover:bg-gray-100 transition-colors ${
                        selectedCallId === call.id ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => handleCallSelect(call.id)}
                    >
                      <CardContent className="p-4">
                        <p className="text-sm font-medium mb-1">
                          {new Date(call.date).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {call.summary}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Column 2: Selected Call Details and Tasks */}
      <div className="w-full lg:w-2/3 space-y-4">
        {selectedCall ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Call Details</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium mb-2">Date: {new Date(selectedCall.date).toLocaleString()}</p>
                <div className="mb-4">
                  <p className="font-medium mb-1">Summary:</p>
                  <p className="text-gray-700">{selectedCall.summary}</p>
                </div>
                <div>
                  <p className="font-medium mb-1">Transcript Preview:</p>
                  <div className="bg-gray-50 p-3 rounded-md max-h-[150px] overflow-y-auto text-sm">
                    {selectedCall.transcript}
                  </div>
                </div>
                <Button
                  className="mt-4"
                  onClick={handleGenerateTasks}
                  disabled={isGeneratingTasks || !organizationId}
                >
                  {isGeneratingTasks ? 'Generating...' : 'Generate Tasks'}
                </Button>
                {error && <p className="text-red-500 mt-2">{error}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingTasks ? (
                  // Loading state for tasks
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={`task-skeleton-${i}`} className="mb-4">
                      <Skeleton className="h-6 w-2/3 mb-2" />
                      <Skeleton className="h-4 w-full mb-1" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ))
                ) : tasks.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-gray-500">No tasks found for this call</p>
                    <p className="text-gray-500 text-sm mt-1">
                      Generate tasks using the button above
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tasks.map(task => (
                      <Card key={task.id} className="border-l-4" style={{ borderLeftColor: task.priority === 'URGENT' ? '#ef4444' : task.priority === 'HIGH' ? '#f59e0b' : task.priority === 'MEDIUM' ? '#3b82f6' : '#9ca3af' }}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-medium">{task.description}</p>
                            <div className="flex gap-2">
                              <Badge className={priorityColors[task.priority] || 'bg-gray-100'}>
                                {task.priority}
                              </Badge>
                              {task.assignedRole && (
                                <Badge className={roleColors[task.assignedRole] || 'bg-gray-100'}>
                                  {task.assignedRole.replace(/_/g, ' ')}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-gray-500">
                            Created: {new Date(task.createdAt).toLocaleString()}
                            {task.dueDate && (
                              <span> • Due: {new Date(task.dueDate).toLocaleString()}</span>
                            )}
                            {task.appointment && (
                              <div className="mt-2 text-xs">
                                <span className="font-medium">Related Appointment:</span>{' '}
                                {format(new Date(task.appointment.date), 'PPp')} - {task.appointment.patient.firstName} {task.appointment.patient.lastName}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-500">Select a call from the list to view details and tasks</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
} 