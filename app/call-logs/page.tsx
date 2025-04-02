"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CallInfo {
  callId: string;
  createdAt: string;
  endedAt: string | null;
  endedReason: string | null;
  transcript: string | null;
  summary: string | null;
  structuredData: Record<string, unknown> | null;
}

interface TranscriptEntry {
  role?: string;
  content: string;
  id?: string;
}

export default function CallLogsPage() {
  const [calls, setCalls] = useState<CallInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<string | null>(null);
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

  // Load calls from the API when assistantId changes
  useEffect(() => {
    const fetchCalls = async () => {
      if (!assistantId) return;
      
      try {
        setLoading(true);
        const res = await fetch(`/api/call-logs?assistantId=${assistantId}`);
        
        if (!res.ok) {
          throw new Error('Failed to fetch call logs');
        }
        
        const data = await res.json();
        setCalls(data);
        
        // Select the first call by default if available
        if (data.length > 0 && !selectedCall) {
          setSelectedCall(data[0].callId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCalls();
  }, [assistantId, selectedCall]);

  // Function to format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  // Function to get selected call data
  const getSelectedCallData = () => {
    return calls.find(call => call.callId === selectedCall);
  };

  // Generate a stable key for transcript lines
  const getStableKey = (content: string, index: number): string => {
    // Create a simple hash from the content
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash) + content.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return `transcript-${index}-${hash}`;
  };

  // Format transcript for readability
  const formatTranscript = (transcript: string | null) => {
    if (!transcript) return 'No transcript available';
    
    // Parse the transcript if it's in a specific format
    try {
      // Try to parse as JSON
      const entries: TranscriptEntry[] = JSON.parse(transcript);
      return entries.map((entry, index) => (
        <div key={getStableKey(entry.content, index)} className={`mb-2 ${entry.role === 'assistant' ? 'text-blue-700' : 'text-gray-800'}`}>
          <span className="font-semibold">{entry.role || 'unknown'}:</span> {entry.content}
        </div>
      ));
    } catch {
      // If it's plain text or failed to parse
      // Simple format assuming "Speaker: Text" format with newlines
      const lines = transcript.split('\n');
      return lines.map((line, index) => (
        <div key={getStableKey(line, index)} className="mb-1">
          {line}
        </div>
      ));
    }
  };

  const selectedCallData = getSelectedCallData();

  // Handle call selection with keyboard support
  const handleCallSelect = (callId: string) => {
    setSelectedCall(callId);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Call Logs</h1>
        <div className="flex gap-4">
          <Link 
            href="/calendar" 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Calendar
          </Link>
          <Link 
            href="/custom-functions" 
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Custom Functions
          </Link>
        </div>
      </div>
      
      {assistantId && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm">
            <span className="font-medium">Assistant ID:</span> {assistantId}
          </p>
        </div>
      )}
      
      {loading && (
        <div className="flex justify-center p-8">Loading call logs...</div>
      )}
      
      {error && (
        <div className="p-4 mb-4 text-red-600 bg-red-100 rounded">Error: {error}</div>
      )}
      
      {!loading && !error && assistantId && calls.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No calls found for this Assistant ID
        </div>
      )}
      
      {calls.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Call List */}
          <div className="col-span-1 border rounded-lg overflow-hidden">
            <div className="bg-gray-100 p-3 font-bold">Call History</div>
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {calls.map(call => (
                <button
                  key={call.callId}
                  type="button"
                  className={`w-full text-left p-3 block cursor-pointer hover:bg-gray-50 ${
                    selectedCall === call.callId ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleCallSelect(call.callId)}
                  role="tab"
                  aria-selected={selectedCall === call.callId}
                >
                  <div className="font-medium">{formatDate(call.createdAt)}</div>
                  <div className="text-sm text-gray-600">
                    Duration: {call.endedAt 
                      ? `${Math.round((new Date(call.endedAt).getTime() - new Date(call.createdAt).getTime()) / 1000)} seconds`
                      : 'Ongoing'}
                  </div>
                  <div className="text-xs text-gray-500">ID: {call.callId}</div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Call Details */}
          <div className="col-span-1 md:col-span-2 border rounded-lg overflow-hidden">
            <div className="bg-gray-100 p-3 font-bold">Call Details</div>
            
            {selectedCallData ? (
              <div className="p-4">
                <div className="mb-4">
                  <h3 className="text-lg font-bold">Call {selectedCallData.callId}</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="font-medium">Started:</span> {formatDate(selectedCallData.createdAt)}</div>
                    <div><span className="font-medium">Ended:</span> {formatDate(selectedCallData.endedAt)}</div>
                    <div><span className="font-medium">Reason:</span> {selectedCallData.endedReason || 'N/A'}</div>
                  </div>
                </div>
                
                {selectedCallData.summary && (
                  <div className="mb-4">
                    <h4 className="font-bold mb-2">Summary</h4>
                    <div className="p-3 bg-gray-50 rounded text-sm">
                      {selectedCallData.summary}
                    </div>
                  </div>
                )}
                
                {selectedCallData.structuredData && (
                  <div className="mb-4">
                    <h4 className="font-bold mb-2">Structured Data</h4>
                    <pre className="p-3 bg-gray-50 rounded text-sm overflow-x-auto">
                      {JSON.stringify(selectedCallData.structuredData, null, 2)}
                    </pre>
                  </div>
                )}
                
                <div>
                  <h4 className="font-bold mb-2">Transcript</h4>
                  <div className="p-3 bg-gray-50 rounded text-sm max-h-[400px] overflow-y-auto">
                    {formatTranscript(selectedCallData.transcript)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                Select a call to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 