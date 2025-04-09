"use client";

import React, { useState, useEffect } from 'react';
import Vapi from '@vapi-ai/web';
import { Mic, MicOff, Play, Square, Loader2, AlertCircle, Bot } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface TestTabProps {
  assistantId: string;
}

interface TranscriptEntry {
  id: string; // Unique ID for React key
  role: 'assistant' | 'user' | 'system' | 'tool_calls' | 'tool_call_result';
  content: string;
  name?: string; // For tool results
  toolCallId?: string; // For tool results/calls
  timestamp: number;
}

// Define a generic message type for Vapi messages
interface VapiMessage {
  type?: string;
  role?: string;
  transcriptType?: string;
  transcript?: string;
  toolCallList?: Array<{
    id: string;
    function?: {
      name?: string;
      arguments?: Record<string, unknown> | string;
    };
  }>;
  toolCallResult?: {
    name: string;
    result?: unknown;
    error?: unknown;
    toolCallId: string;
  };
  content?: string;
  message?: string;
}

export function TestTab({ assistantId }: TestTabProps) {
  const [assistant, setAssistant] = useState<Vapi | null>(null);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [showToolCallNotification, setShowToolCallNotification] = useState<string | null>(null);
  const [showToolResultNotification, setShowToolResultNotification] = useState<string | null>(null);

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;

  useEffect(() => {
    if (!publicKey) {
      setError("Unable to initialize the test system.");
      return;
    }
    const assistant = new Vapi(publicKey);
    setAssistant(assistant);

    assistant.on('call-start', () => {
      console.log('Test Call Started');
      setIsSessionActive(true);
      setIsConnecting(false);
      setError(null);
      setTranscript([]); // Clear transcript on new call
    });
    assistant.on('call-end', () => {
      console.log('Test Call Ended');
      setIsSessionActive(false);
      setIsConnecting(false);
      setIsMuted(false); // Reset mute state on call end
    });
    assistant.on('message', (message: VapiMessage) => {
      console.log('Received message:', message); // Keep for debugging

      const createEntry = (role: TranscriptEntry['role'], content: string, name?: string, toolCallId?: string): TranscriptEntry => ({
        id: `${Date.now()}-${Math.random()}`, // Simple unique key
        role,
        content,
        name,
        toolCallId,
        timestamp: Date.now()
      });

      setTranscript(prev => {
        const newEntries: TranscriptEntry[] = [];

        switch (message.type) {
          case 'transcript':
            // Only add final transcripts to the main log for clarity
            if (message.transcriptType === 'final' && message.role && message.transcript) {
              newEntries.push(createEntry(message.role as TranscriptEntry['role'], message.transcript));
            }
            break;
          case 'tool-calls':
            if (message.toolCallList && message.toolCallList.length > 0) {
              for (const tc of message.toolCallList) {
                const argsString = JSON.stringify(tc.function?.arguments || {});
                const content = `Calling tool: ${tc.function?.name}(${argsString})`;
                newEntries.push(createEntry('tool_calls', content, tc.function?.name, tc.id));
                // Trigger toaster
                setShowToolCallNotification(`Calling: ${tc.function?.name}`);
                setTimeout(() => setShowToolCallNotification(null), 3000); // Hide after 3s
              }
            }
            break;
          case 'tool-calls-result':
             if (message.toolCallResult) {
                const resultString = JSON.stringify(message.toolCallResult.result || message.toolCallResult.error || 'No result/error provided');
                const content = `Tool Result (${message.toolCallResult.name}): ${resultString}`;
                newEntries.push(createEntry('tool_call_result', content, message.toolCallResult.name, message.toolCallResult.toolCallId));
                // Trigger result toaster
                setShowToolResultNotification(`Result for ${message.toolCallResult.name}: ${resultString.substring(0, 50)}...`);
                 setTimeout(() => setShowToolResultNotification(null), 4000); // Hide after 4s
             }
            break;
          default:
             // If the message has a 'role' and 'content' or 'message', add it generically
             if (message.role && (message.content || message.message)) {
                 const content = message.content || message.message || '[No Content]';
                 // Avoid adding duplicates if transcript event already handled it
                 if (!prev.some(entry => entry.content === content && entry.role === message.role)) {
                    newEntries.push(createEntry(message.role as TranscriptEntry['role'], content as string));
                 }
             }
        }
        return [...prev, ...newEntries];
      });
    });
    assistant.on('error', (e) => {
      console.error('Assistant Error:', e);
      setError(e?.message || 'An unknown error occurred during the call.');
      setIsSessionActive(false);
      setIsConnecting(false);
    });

    return () => {
      assistant.stop(); // Ensure call stops if component unmounts
      // Clean up listeners if assistant SDK provides an 'off' method or similar
    };
  }, [publicKey]); // Re-initialize if publicKey changes

  const handleStartCall = async () => {
    if (!assistant || !assistantId) return;
    setIsConnecting(true);
    setError(null);
    setTranscript([]); // Clear transcript
    try {
      await assistant.start(assistantId);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(`Failed to start test call: ${errorMsg}`);
      setIsConnecting(false);
    }
  };

  const handleStopCall = async () => {
    if (!assistant) return;
    try {
      await assistant.stop();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(`Failed to stop test call: ${errorMsg}`);
    } finally {
      setIsSessionActive(false);
      setIsConnecting(false);
    }
  };

  const toggleMute = () => {
    if (!assistant) return;
    const newMutedState = !isMuted;
    assistant.setMuted(newMutedState);
    setIsMuted(newMutedState);
  };

  return (
    <div className="space-y-6 p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <Bot className="mr-2 h-5 w-5 text-gray-600 dark:text-gray-400" /> Test Assistant
      </h2>

      {!publicKey && (
         <Alert variant="destructive">
           <AlertCircle className="h-4 w-4" />
           <AlertTitle>Configuration Error</AlertTitle>
           <AlertDescription>The assistant test system is not fully configured. Please contact your administrator.</AlertDescription>
         </Alert>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4">
        {!isSessionActive ? (
          <Button
            onClick={handleStartCall}
            disabled={!assistant || isConnecting || !publicKey || !assistantId}
            className="w-full sm:w-auto"
          >
            {isConnecting ? (
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
            ) : (
              <Play className="mr-2 h-5 w-5" />
            )}
            {isConnecting ? 'Connecting...' : 'Start Test Call'}
          </Button>
        ) : (
          <Button
            onClick={handleStopCall}
            variant="destructive"
            disabled={!assistant}
            className="w-full sm:w-auto"
          >
            <Square className="mr-2 h-5 w-5" /> End Test Call
          </Button>
        )}
        <Button
          variant="outline"
          onClick={toggleMute}
          disabled={!isSessionActive}
          className="w-full sm:w-auto"
        >
          {isMuted ? <MicOff className="mr-2 h-5 w-5" /> : <Mic className="mr-2 h-5 w-5" />}
          {isMuted ? 'Unmute Mic' : 'Mute Mic'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Call Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Transcript Display Area */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded min-h-[200px] max-h-[400px] overflow-y-auto space-y-2">
        <p className="text-xs text-gray-500 dark:text-gray-400 sticky top-0 bg-gray-50 dark:bg-gray-700 py-1">Conversation Transcript:</p>
        {transcript.length === 0 && !isSessionActive && <p className="text-sm text-gray-500 dark:text-gray-400">Call not active.</p>}
        {transcript.length === 0 && isSessionActive && <p className="text-sm text-gray-500 dark:text-gray-400">Waiting for speech...</p>}
        {transcript.map((entry) => (
          <div key={entry.id} className={`text-sm ${
            entry.role === 'user' ? 'text-right' : 'text-left'
          }`}>
            <span className={`inline-block p-2 rounded-lg max-w-[80%] ${
              entry.role === 'assistant' ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100' :
              entry.role === 'user' ? 'bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100' :
              entry.role === 'system' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100 italic' :
              entry.role === 'tool_calls' ? 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100 font-mono text-xs' :
              entry.role === 'tool_call_result' ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-mono text-xs' :
              'bg-gray-100 dark:bg-gray-600' // Default/System
            }`}>
              <span className="font-bold capitalize">{entry.role.replace('_', ' ')}{entry.name ? ` (${entry.name})` : ''}: </span>
              {entry.content}
            </span>
          </div>
        ))}
      </div>

      {/* Tool Call Toaster Notification */}
      {showToolCallNotification && (
        <div className="fixed bottom-4 right-4 bg-blue-500 text-white p-3 rounded-lg shadow-lg animate-pulse z-50 text-sm">
          {showToolCallNotification}
        </div>
      )}

      {/* Tool Result Toaster Notification */}
       {showToolResultNotification && (
         <div className="fixed bottom-16 right-4 bg-green-500 text-white p-3 rounded-lg shadow-lg z-50 text-sm max-w-xs break-words">
           {showToolResultNotification}
         </div>
       )}
    </div>
  );
} 