// app/demo/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import type { FC } from 'react';
import Vapi from '@vapi-ai/web';
import {
  Mic, MicOff, Bot, Terminal, AlertCircle, Settings2, Play, Square, Volume2, CircleDot
} from 'lucide-react';

// Define types for messages and logs
interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool' | 'function';
  content?: string;
  toolCalls?: Array<{
    id?: string;
    name?: string; 
    parameters?: Record<string, unknown>;
    function?: {
      name: string;
      arguments?: string;
    };
  }>;
  toolCallId?: string;
  name?: string;
  result?: string;
  timestamp: number;
  type?: 'transcript' | 'function-call' | 'tool-calls-result'; // Add type for easier handling
  transcriptType?: 'partial' | 'final'; // Specific to transcript messages
}

interface ToolCallLog {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
  result?: string;
  error?: string;
  timestamp: number;
  aiRequest?: string;
  aiResponse?: string;
}

interface VapiMessage {
  type: string;
  transcript?: string;
  transcriptType?: 'partial' | 'final';
  role?: 'user' | 'assistant' | 'system' | 'tool' | 'function';
  functionCall?: {
    id: string;
    name: string;
    parameters: Record<string, unknown>;
  };
  toolCallResult?: {
    toolCallId: string;
    name?: string;
    result?: string;
    error?: string;
  };
  status?: string;
  endedReason?: string;
  conversation?: Array<{
    role: string;
    content?: string;
    tool_calls?: Array<{
      id: string;
      function?: {
        name: string;
        arguments?: string;
      };
    }>;
    tool_call_id?: string;
  }>;
}

const DemoPage: FC = () => {
  // State variables
  const [vapiInstance, setVapiInstance] = useState<Vapi | null>(null);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState<boolean>(false);
  const [assistantVolume, setAssistantVolume] = useState<number>(0);
  const [transcript, setTranscript] = useState<Message[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallLog[]>([]);
  const [lastStatusUpdate, setLastStatusUpdate] = useState<string>('Idle');
  const [error, setError] = useState<string | null>(null);

  // Refs for auto-scrolling
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const toolCallsEndRef = useRef<HTMLDivElement>(null);

  // Assistant ID and Public Key from environment variables
  const assistantId = "5ddeb40e-9013-47f3-b980-2091e6b9269e";
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;

  // Helper function to log events
  const logEvent = useCallback((type: string, message: string, payload?: unknown) => {
    console.log(`[${type}] ${message}`, payload || '');
  }, []);

  // Initialize Vapi SDK
  useEffect(() => {
    if (!publicKey) {
      setError("VAPI Public Key is missing. Please set NEXT_PUBLIC_VAPI_PUBLIC_KEY environment variable.");
      logEvent('Error', 'VAPI Public Key is missing.');
      return;
    }
    const vapi = new Vapi(publicKey);
    setVapiInstance(vapi);
    logEvent('Info', 'Vapi SDK Initialized');

    // --- Event Listeners ---
    const handleCallStart = () => {
      logEvent('Info', 'Call started');
      setIsSessionActive(true);
      setTranscript([]);
      setToolCalls([]);
      setError(null);
      setLastStatusUpdate('Connecting...');
    };

    const handleCallEnd = () => {
      logEvent('Info', 'Call ended');
      setIsSessionActive(false);
      setLastStatusUpdate('Call Ended');
      setIsAssistantSpeaking(false);
      setAssistantVolume(0);
    };

    const handleSpeechStart = () => {
      logEvent('Info', 'Assistant speech started');
      setIsAssistantSpeaking(true);
    };

    const handleSpeechEnd = () => {
      logEvent('Info', 'Assistant speech ended');
      setIsAssistantSpeaking(false);
    };

    const handleVolumeLevel = (volume: number) => {
      setAssistantVolume(volume);
    };

    const handleMessage = (message: VapiMessage) => {
      logEvent('Message', `Received message of type: ${message.type}`, message);
      const timestamp = Date.now();

      if (message.type === 'transcript' && message.transcript) {
        setTranscript(prev => {
          const lastMessage = prev[prev.length - 1];
          // If the last message was partial from the same role, update it
          if (lastMessage?.role === message.role && lastMessage?.transcriptType === 'partial') {
            const updatedMessage = { ...lastMessage, content: message.transcript, transcriptType: message.transcriptType, timestamp };
            return [...prev.slice(0, -1), updatedMessage];
          }
          // Otherwise, add a new message
          return [...prev, { 
            role: message.role || 'user', 
            content: message.transcript, 
            transcriptType: message.transcriptType, 
            timestamp 
          }];
        });
      } else if (message.type === 'function-call' && message.functionCall) {
        // Add to tool calls
        const functionCall = message.functionCall;
        setToolCalls(prev => [...prev, {
          id: functionCall.id || `fc-${timestamp}`,
          name: functionCall.name,
          parameters: functionCall.parameters,
          timestamp,
        }]);
        
        // Add to transcript with properly formatted toolCalls
        setTranscript(prev => [...prev, { 
          role: 'assistant', 
          toolCalls: [{
            id: functionCall.id,
            name: functionCall.name,
            parameters: functionCall.parameters,
            function: {
              name: functionCall.name,
              arguments: JSON.stringify(functionCall.parameters)
            }
          }], 
          timestamp, 
          type: 'function-call' 
        }]);
      } else if (message.type === 'tool-calls-result' && message.toolCallResult) {
        const { toolCallId, result, error, name } = message.toolCallResult;
        
        // Update the corresponding tool call log with the result
        setToolCalls(prev => prev.map(tc =>
          tc.id === toolCallId
            ? { ...tc, result, error }
            : tc
        ));
        
        // Add result to transcript
        setTranscript(prev => [...prev, {
          role: 'tool',
          toolCallId,
          name, // Assuming name is available in result, adjust if needed
          result,
          timestamp,
          type: 'tool-calls-result'
        }]);
      } else if (message.type === 'status-update' && message.status) {
        setLastStatusUpdate(message.status);
        logEvent('Status', `Call status updated: ${message.status}`, message);
        if (message.status === 'ended' && message.endedReason) {
          logEvent('Info', `Call ended reason: ${message.endedReason}`);
        }
      } else if (message.type === 'conversation-update' && message.conversation) {
        // Process tool calls from conversation updates
        const lastMessage = message.conversation[message.conversation.length - 1];
        
        if (lastMessage.role === 'assistant' && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
          // Process each tool call in the conversation update
          for (const toolCall of lastMessage.tool_calls) {
            const toolCallId = toolCall.id;
            const name = toolCall.function?.name || '';
            const argsString = toolCall.function?.arguments || '{}';
            let parameters = {};
            
            try {
              parameters = JSON.parse(argsString);
            } catch (e) {
              console.error('Error parsing tool call arguments:', e);
            }
            
            // Add to tool calls collection
            setToolCalls(prev => {
              // Check if this tool call is already in the list
              const exists = prev.some(tc => tc.id === toolCallId);
              if (exists) return prev;
              
              return [...prev, {
                id: toolCallId,
                name,
                parameters,
                timestamp,
              }];
            });
          }
        }
        
        // Process tool results from conversation updates
        if (lastMessage.role === 'tool' && lastMessage.tool_call_id) {
          const toolCallId = lastMessage.tool_call_id;
          const result = lastMessage.content;
          
          // Update existing tool call with result
          setToolCalls(prev => prev.map(tc =>
            tc.id === toolCallId
              ? { ...tc, result, aiResponse: lastMessage.content }
              : tc
          ));
        }
      }
      // Add other message type handlers as needed
    };

    const handleError = (e: Error) => {
      const errorMessage = e?.message || 'An unknown error occurred';
      logEvent('Error', errorMessage, e);
      setError(errorMessage);
      setIsSessionActive(false); // Assume call ends on error
    };

    vapi.on('call-start', handleCallStart);
    vapi.on('call-end', handleCallEnd);
    vapi.on('speech-start', handleSpeechStart);
    vapi.on('speech-end', handleSpeechEnd);
    vapi.on('volume-level', handleVolumeLevel);
    vapi.on('message', handleMessage);
    vapi.on('error', handleError);

    // Cleanup function
    return () => {
      logEvent('Info', 'Cleaning up Vapi listeners');
      vapi.off('call-start', handleCallStart);
      vapi.off('call-end', handleCallEnd);
      vapi.off('speech-start', handleSpeechStart);
      vapi.off('speech-end', handleSpeechEnd);
      vapi.off('volume-level', handleVolumeLevel);
      vapi.off('message', handleMessage);
      vapi.off('error', handleError);
      // Ensure call is stopped if component unmounts while active
      if (vapi.isMuted()) { // Check if instance methods are available
         vapi.stop();
      }
    };
  }, [publicKey, logEvent]); // Rerun if publicKey changes

  // Auto-scrolling effects
  useEffect(() => {
    if (transcript.length > 0) {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript]);

  useEffect(() => {
    if (toolCalls.length > 0) {
      toolCallsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [toolCalls]);

  // --- Action Handlers ---
  const handleStartCall = async () => {
    if (!vapiInstance) {
      setError("Vapi SDK not initialized.");
      logEvent('Error', 'Attempted to start call before SDK initialization');
      return;
    }
    setError(null);
    setLastStatusUpdate('Starting Call...');
    logEvent('Action', 'Start Call button clicked');
    try {
      await vapiInstance.start(assistantId);
      // Status update will be handled by the 'call-start' event listener
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(`Failed to start call: ${errorMsg}`);
      logEvent('Error', `Failed to start call: ${errorMsg}`, e);
      setIsSessionActive(false);
      setLastStatusUpdate('Idle');
    }
  };

  const handleStopCall = async () => {
    if (!vapiInstance) return;
    setError(null);
    setLastStatusUpdate('Stopping Call...');
    logEvent('Action', 'Stop Call button clicked');
    try {
      await vapiInstance.stop();
      // Status update will be handled by the 'call-end' event listener
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(`Failed to stop call: ${errorMsg}`);
      logEvent('Error', `Failed to stop call: ${errorMsg}`, e);
      // Force state update if event doesn't fire
      setIsSessionActive(false);
      setLastStatusUpdate('Idle');
    }
  };

  const toggleMute = () => {
    if (!vapiInstance) return;
    const newMutedState = !isMuted;
    vapiInstance.setMuted(newMutedState);
    setIsMuted(newMutedState);
    logEvent('Action', `Microphone ${newMutedState ? 'muted' : 'unmuted'}`);
  };

  // Helper to format timestamp
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 space-y-4">
      <h1 className="text-2xl font-bold text-center">Claire Core</h1>

      {/* Controls */}
      <div className="flex justify-center items-center space-x-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        {!isSessionActive ? (
          <button
            type="button"
            onClick={handleStartCall}
            className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition duration-150 disabled:opacity-50"
            disabled={!vapiInstance}
          >
            <Play className="mr-2 h-5 w-5" /> Start Call
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStopCall}
            className="flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition duration-150 disabled:opacity-50"
            disabled={!vapiInstance}
          >
            <Square className="mr-2 h-5 w-5" /> End Call
          </button>
        )}
        <button
          type="button"
          onClick={toggleMute}
          className={`flex items-center px-4 py-2 rounded-lg transition duration-150 ${isMuted ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600'} text-white disabled:opacity-50`}
          disabled={!isSessionActive}
        >
          {isMuted ? <MicOff className="mr-2 h-5 w-5" /> : <Mic className="mr-2 h-5 w-5" />}
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
      </div>

      {/* Status Indicators */}
      <div className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow text-sm">
        <div className="flex items-center space-x-2">
          <CircleDot className={`h-4 w-4 ${isSessionActive ? 'text-green-500' : 'text-red-500'}`} />
          <span>Status: {lastStatusUpdate}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Bot className={`h-4 w-4 ${isAssistantSpeaking ? 'text-blue-500 animate-pulse' : 'text-gray-400'}`} />
          <span>Assistant Speaking: {isAssistantSpeaking ? 'Yes' : 'No'}</span>
        </div>
        <div className="flex items-center space-x-2 w-32">
          <Volume2 className="h-4 w-4" />
          <span>Volume:</span>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${assistantVolume * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded-lg shadow flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>Error: {error}</span>
        </div>
      )}

      {/* Main Content Area (Transcript and Tool Activity) - Changed to 2 columns */}
      <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden">
        {/* Transcript */}
        <div className="flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <h2 className="text-lg font-semibold p-3 border-b border-gray-200 dark:border-gray-700 flex items-center">
            <Terminal className="mr-2 h-5 w-5" /> Live Transcript
          </h2>
          <div className="flex-grow p-3 space-y-2 overflow-y-auto">
            {transcript.map((msg) => (
              <div key={`${msg.timestamp}-${msg.role}-${msg.type || ''}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-2 rounded-lg ${msg.role === 'user' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  <span className="font-bold capitalize">{msg.role}: </span>
                  {msg.content || (msg.toolCalls ? `Tool Call: ${msg.toolCalls[0]?.function?.name}` : `Tool Result: ${msg.result}`)}
                  <span className="text-xs text-gray-500 dark:text-gray-400 block text-right mt-1">
                    {formatTimestamp(msg.timestamp)} {msg.transcriptType === 'partial' ? '(partial)' : ''}
                  </span>
                </div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Tool Activity Log - Simplified and Enhanced */}
        <div className="flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <h2 className="text-lg font-semibold p-3 border-b border-gray-200 dark:border-gray-700 flex items-center">
            <Settings2 className="mr-2 h-5 w-5" /> Tool Activity Log
          </h2>
          <div className="flex-grow p-3 space-y-4 overflow-y-auto">
            {toolCalls.map((tc) => (
              <div key={tc.id} className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
                {/* Tool Call Header */}
                <div className="bg-blue-50 dark:bg-blue-900 p-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-blue-700 dark:text-blue-300">Tool: {tc.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatTimestamp(tc.timestamp)}</span>
                  </div>
                </div>
                
                {/* Tool Request */}
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <p className="font-semibold text-sm mb-1">Request Parameters:</p>
                  <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                    {JSON.stringify(tc.parameters, null, 2)}
                  </pre>
                </div>
                
                {/* Tool Response */}
                <div className="p-3">
                  <p className="font-semibold text-sm mb-1">Response:</p>
                  {tc.result ? (
                    <pre className="text-xs bg-green-50 dark:bg-green-900 p-2 rounded overflow-x-auto">
                      {tc.result}
                    </pre>
                  ) : tc.error ? (
                    <pre className="text-xs bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-300 p-2 rounded overflow-x-auto">
                      {tc.error}
                    </pre>
                  ) : (
                    <div className="text-xs italic text-gray-500">Waiting for response...</div>
                  )}
                </div>
                
                {/* AI Response (if available) */}
                {tc.aiResponse && (
                  <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-purple-50 dark:bg-purple-900">
                    <p className="font-semibold text-sm mb-1">AI Response:</p>
                    <div className="text-xs p-2 rounded bg-white dark:bg-gray-800">
                      {tc.aiResponse}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {toolCalls.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 italic p-4">
                No tool activity yet. Have a conversation with Claire to see tool calls.
              </div>
            )}
            <div ref={toolCallsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoPage;