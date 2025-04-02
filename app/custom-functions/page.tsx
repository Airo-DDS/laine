"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ToolInfo {
  type: string;
  name?: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

interface ParameterInfo {
  type?: string;
  description?: string;
}

export default function CustomFunctionsPage() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assistantId, setAssistantId] = useState<string>('');

  // Load assistant ID from environment
  useEffect(() => {
    const fetchAssistantId = async () => {
      try {
        const res = await fetch('/api/assistant-config');
        if (!res.ok) throw new Error('Failed to load configuration');
        
        const data = await res.json();
        if (data.assistantId) {
          setAssistantId(data.assistantId);
        } else {
          setError('No assistant ID found in configuration');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    };
    
    fetchAssistantId();
  }, []);

  // Load tools for the assistant when assistantId changes
  useEffect(() => {
    const fetchTools = async () => {
      if (!assistantId) return;
      
      try {
        setLoading(true);
        const res = await fetch(`/api/custom-functions?assistantId=${assistantId}`);
        
        if (!res.ok) {
          throw new Error('Failed to fetch custom functions');
        }
        
        const data = await res.json();
        setTools(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTools();
  }, [assistantId]);

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Custom Functions</h1>
        <div className="flex gap-4">
          <Link 
            href="/calendar" 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Calendar
          </Link>
          <Link 
            href="/call-logs" 
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Call Logs
          </Link>
        </div>
      </div>
      
      <div className="mb-6">
        <p>
          These are the custom functions (tools) that your VAPI assistant uses to check appointment availability
          and book appointments. Below you can see the details of each function, including its parameters
          and description.
        </p>
      </div>
      
      {assistantId && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm">
            <span className="font-medium">Assistant ID:</span> {assistantId}
          </p>
        </div>
      )}
      
      {loading && assistantId && (
        <div className="flex justify-center p-8">Loading custom functions...</div>
      )}
      
      {error && (
        <div className="p-4 mb-4 text-red-600 bg-red-100 rounded">Error: {error}</div>
      )}
      
      <div className="space-y-6">
        {tools.length > 0 ? (
          tools.map((tool, index) => (
            <div key={tool.name || `tool-${index}`} className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 p-3 font-bold flex justify-between items-center">
                <div>
                  {tool.name || 'Unnamed Function'} 
                  <span className="ml-2 text-xs font-normal bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    {tool.type}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="mb-4">
                  <h3 className="font-bold mb-1">Description</h3>
                  <p className="text-sm">{tool.description || 'No description provided'}</p>
                </div>
                
                <div>
                  <h3 className="font-bold mb-1">Parameters</h3>
                  {tool.parameters && Object.keys(tool.parameters).length > 0 ? (
                    <div className="border rounded overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {Object.entries(tool.parameters).map(([name, param]) => {
                            const typedParam = param as ParameterInfo;
                            return (
                              <tr key={name}>
                                <td className="px-4 py-2 text-sm font-medium">{name}</td>
                                <td className="px-4 py-2 text-sm text-gray-500">{typedParam.type || 'unknown'}</td>
                                <td className="px-4 py-2 text-sm text-gray-500">{typedParam.description || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No parameters</p>
                  )}
                </div>
                
                <div className="mt-4">
                  <h3 className="font-bold mb-1">Implementation</h3>
                  <div className="text-sm text-gray-600">
                    {tool.name === 'checkAvailability' && (
                      <p className="text-sm">
                        This function queries our appointment database to find available time slots. 
                        It filters out times that already have appointments and weekends/non-business hours.
                        The implementation is in <code className="bg-gray-100 px-1">app/api/claire/check-availability/route.ts</code>.
                      </p>
                    )}
                    {tool.name === 'bookAppointment' && (
                      <p className="text-sm">
                        This function creates a new appointment in our database. It also creates a new patient
                        record if the email doesn&apos;t match an existing patient. The implementation is in 
                        {' '}<code className="bg-gray-100 px-1">app/api/claire/book-appointment/route.ts</code>.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : !loading && assistantId ? (
          <div className="p-8 text-center text-gray-500">
            No custom functions found for this Assistant ID
          </div>
        ) : null}
      </div>
    </div>
  );
} 