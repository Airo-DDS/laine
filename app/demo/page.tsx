"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import type { FC } from 'react';
// Assuming VapiImpl is the correct import name from the SDK
import { default as VapiImpl } from '@vapi-ai/web';
// Log SDK import status
console.log('Vapi SDK imported:', { 
  sdk: typeof VapiImpl === 'function' ? 'Function' : typeof VapiImpl,
  constructor: VapiImpl?.toString?.().substring(0, 100) || 'Not available'
});
// Import specific types from the SDK if available, otherwise define interfaces
// Example: import type { VapiEventMessage, ToolCall, ToolCallResult } from '@vapi-ai/web'; 
import { 
  Mic, MicOff, PhoneOff, Bot, Loader2, X, AlertCircle, CheckCircle, 
  Info, Zap, LogOut, MessageSquareText, Ear, EarOff, Activity 
} from 'lucide-react';

// --- Interfaces (Define if not exported by SDK) ---
// These might differ slightly based on the exact SDK exports
interface VapiToolCallFunction {
  name: string;
  arguments: string; // JSON string
}
interface VapiToolCall {
  id: string; // This is the crucial toolCallId
  type: 'function';
  function?: VapiToolCallFunction;
}
interface VapiToolCallResult {
  toolCallId: string;
  result?: string; // Can be JSON string or plain text
  error?: string;
}
// --- End Interfaces ---


// --- Toast Component ---
const toastAnimations = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  .animate-slideIn {
    animation: slideIn 0.3s ease-out forwards;
  }
`;

interface Toast {
  id: string;
  type: 'info' | 'success' | 'error' | 'warning';
  title: string;
  message: string;
  duration?: number;
}

const ToastContainer: FC<{ toasts: Toast[], removeToast: (id: string) => void }> = ({ toasts, removeToast }) => {
  return (
    <>
      <style jsx global>{toastAnimations}</style>
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full sm:w-auto">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`p-4 rounded-lg shadow-lg flex items-start gap-3 animate-slideIn ${
              toast.type === 'success' ? 'bg-green-100 text-green-800 border-l-4 border-green-500 dark:bg-green-900/30 dark:text-green-200 dark:border-green-600' :
              toast.type === 'error' ? 'bg-red-100 text-red-800 border-l-4 border-red-500 dark:bg-red-900/30 dark:text-red-200 dark:border-red-600' :
              toast.type === 'warning' ? 'bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-600' :
              'bg-blue-100 text-blue-800 border-l-4 border-blue-500 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-600'
            }`}
            role="alert"
          >
            <div className={`shrink-0 pt-0.5 ${
              toast.type === 'success' ? 'text-green-500' :
              toast.type === 'error' ? 'text-red-500' :
              toast.type === 'warning' ? 'text-yellow-500' :
              'text-blue-500'
            }`}>
              {toast.type === 'success' ? <CheckCircle size={20} /> :
              toast.type === 'error' ? <AlertCircle size={20} /> :
              toast.type === 'warning' ? <AlertCircle size={20} /> :
              <Info size={20} />}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm">{toast.title}</h3>
              <p className="text-xs whitespace-pre-wrap">{toast.message}</p>
            </div>
            <button 
              onClick={() => removeToast(toast.id)} 
              className="shrink-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              aria-label="Close"
              type="button"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
};
// --- End Toast Component ---


// --- UI Components ---
const Button = ({ 
  onClick, 
  children, 
  disabled = false, 
  className = '' 
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    type="button"
    className={`inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
  >
    {children}
  </button>
);

const StatusIndicator = ({ status }: { status: string }) => (
  <div className="mt-4 p-2 border rounded-md bg-gray-100 dark:bg-gray-800 text-center w-full max-w-md shadow-sm">
    <strong>Status:</strong> <span className="font-mono text-sm ml-2">{status}</span>
  </div>
);

const TranscriptDisplay = ({ transcript, transcriptRef }: { transcript: string, transcriptRef: React.RefObject<HTMLDivElement | null> }) => (
  <div ref={transcriptRef as React.RefObject<HTMLDivElement>} className="mt-1 p-3 border rounded-md h-96 overflow-y-auto bg-gray-50 dark:bg-gray-700 font-mono text-xs shadow-inner">
    <pre className="whitespace-pre-wrap">{transcript}</pre>
  </div>
);

const VolumeIndicator = ({ level }: { level: number }) => (
  <div className="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded mt-2 overflow-hidden">
    <div
      className="h-full bg-green-500 rounded transition-width duration-100 ease-linear"
      style={{ width: `${Math.min(level * 100, 100)}%` }}
    />
  </div>
);

interface FunctionCall {
  id: string; // Use toolCallId as the key
  name: string;
  parameters: Record<string, unknown>;
  timestamp: Date;
  result?: string;
  error?: string;
  pending: boolean;
}

const FunctionCallsList = ({ calls }: { calls: FunctionCall[] }) => {
  if (calls.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No function calls yet.</p>;
  
  return (
    <div className="mt-1 space-y-3 h-96 overflow-y-auto pr-2">
      {calls.map((call) => (
        <div key={call.id} className="p-3 border rounded-md bg-white dark:bg-gray-800 shadow">
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-bold text-blue-600 dark:text-blue-400 text-sm flex items-center gap-1">
              <Zap size={14} /> {call.name}
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">{call.timestamp.toLocaleTimeString()}</span>
          </div>
          <div className="text-xs">
            <p className="font-semibold mb-1 text-gray-700 dark:text-gray-300">Parameters:</p>
            <div className="font-mono bg-gray-100 dark:bg-gray-900 p-1.5 rounded text-xs overflow-x-auto max-h-20">
              <pre>{JSON.stringify(call.parameters, null, 2)}</pre>
            </div>
            
            {call.pending && (
              <div className="flex items-center mt-2 text-amber-600 dark:text-amber-400">
                <Loader2 className="animate-spin mr-1.5" size={14}/>
                Processing...
              </div>
            )}
            
            {call.result && (
              <div className="mt-2">
                <span className="font-semibold text-green-700 dark:text-green-400">Result:</span>
                <div className="font-mono bg-green-50 dark:bg-green-900/30 p-1.5 rounded text-xs mt-1 max-h-20 overflow-y-auto">
                  <pre className="whitespace-pre-wrap">{call.result}</pre>
                </div>
              </div>
            )}
            
            {call.error && (
              <div className="mt-2">
                <span className="font-semibold text-red-600 dark:text-red-400">Error:</span>
                <div className="font-mono bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-1.5 rounded text-xs mt-1 max-h-20 overflow-y-auto">
                 <pre className="whitespace-pre-wrap">{call.error}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

interface EventLogEntry {
  timestamp: Date;
  type: string;
  details: string;
  icon: React.ReactNode;
}

const EventLogList = ({ logEntries }: { logEntries: EventLogEntry[] }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Scroll to top when new log entry is added
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, []); // Remove logEntries dependency

  if (logEntries.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No events logged yet.</p>;

  return (
    <div ref={logContainerRef} className="mt-1 space-y-2 h-96 overflow-y-auto pr-2 border rounded-md bg-gray-50 dark:bg-gray-700 shadow-inner">
      {logEntries.map((entry, index) => (
        <div key={`${entry.timestamp.getTime()}-${index}`} className="p-2 border-b border-gray-200 dark:border-gray-600 text-xs flex items-start gap-2 last:border-b-0">
          <span className="shrink-0 pt-0.5">{entry.icon}</span>
          <div className="flex-1 min-w-0"> {/* Added min-w-0 for flexbox truncation */}
            <span className="font-semibold mr-1">{entry.type}</span>
            <span className="text-gray-600 dark:text-gray-300 break-words">{entry.details}</span> {/* Added break-words */}
          </div>
          <span className="text-gray-400 dark:text-gray-500 shrink-0 ml-2">{entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      ))}
    </div>
  );
};

// --- End UI Components ---

const DemoPage: FC = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState<string>('Idle');
  const [transcript, setTranscript] = useState<string>('');
  const [assistantIsSpeaking, setAssistantIsSpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [functionCalls, setFunctionCalls] = useState<FunctionCall[]>([]);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const vapiRef = useRef<VapiImpl | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const assistantId = '5ddeb40e-9013-47f3-b980-2091e6b9269e'; // Claire Assistant ID
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;

  // --- Utility Functions ---
  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };
    // Add new toast to the beginning and limit to 5
    setToasts(prev => [newToast, ...prev].slice(0, 5)); 
    
    const duration = toast.duration || 6000;
    setTimeout(() => removeToast(id), duration);
    return id;
  }, []); // No dependencies needed if removeToast is stable
  
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []); // No dependencies needed

  const formatJsonForDisplay = useCallback((jsonObject: Record<string, unknown> | string | undefined): string => {
    if (typeof jsonObject === 'string') {
      try {
        const parsed = JSON.parse(jsonObject);
        return JSON.stringify(parsed, null, 2);
      } catch (e) {
        return jsonObject; // Return original string if not valid JSON
      }
    }
    if (typeof jsonObject === 'object' && jsonObject !== null) {
      return JSON.stringify(jsonObject, null, 2);
    }
    return String(jsonObject ?? 'N/A'); // Handle undefined/null
  }, []);

  const addEventLog = useCallback((type: string, details: string, icon: React.ReactNode) => {
    // Add new entry to the beginning and limit to 100
    setEventLog(prev => [{ timestamp: new Date(), type, details, icon }, ...prev].slice(0, 100)); 
  }, []); // No dependencies needed

  // Scroll transcript to bottom
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, []); // Remove transcript dependency

  // --- Vapi Initialization and Event Listeners ---
  useEffect(() => {
    if (!publicKey) {
      console.error('VAPI Public Key is not set.');
      setCallStatus('Error: Missing Public Key');
      addToast({ type: 'error', title: 'Config Error', message: 'VAPI Public Key missing.' });
      return;
    }
    
    console.log('Initializing Vapi SDK...');
    try {
      const vapiInstance = new VapiImpl(publicKey);
      console.log('Vapi instance created successfully');
      vapiRef.current = vapiInstance;
      addEventLog('SDK', 'Initialized', <Zap size={14} className="text-purple-500"/>);

      // --- Event Listeners ---
      vapiInstance.on('call-start', () => {
        console.log('Event: call-start');
        setCallStatus('Connected');
        setIsSessionActive(true);
        setTranscript('Call started...\n'); 
        setFunctionCalls([]); 
        setEventLog([]); 
        addEventLog('Call', 'Started', <PhoneOff size={14} className="text-green-500" />);
        addToast({ type: 'success', title: 'Call Started', message: 'Connected to Claire.' });
      });

      vapiInstance.on('call-end', (endDetails?: { reason?: string }) => {
        console.log('Event: call-end', endDetails);
        const reason = endDetails?.reason || 'Unknown reason';
        setCallStatus(`Call Ended: ${reason}`);
        setIsSessionActive(false);
        setAssistantIsSpeaking(false);
        setVolumeLevel(0);
        addEventLog('Call', `Ended (${reason})`, <LogOut size={14} className="text-red-500" />);
        addToast({ type: 'info', title: 'Call Ended', message: `Reason: ${reason}`, duration: 8000 });
      });

      vapiInstance.on('speech-start', () => {
        console.log('Event: speech-start (Assistant)');
        setAssistantIsSpeaking(true);
        addEventLog('Speech', 'Assistant started speaking', <Ear size={14} className="text-blue-500" />);
      });

      vapiInstance.on('speech-end', () => {
        console.log('Event: speech-end (Assistant)');
        setAssistantIsSpeaking(false);
        addEventLog('Speech', 'Assistant stopped speaking', <EarOff size={14} className="text-gray-500" />);
      });

      vapiInstance.on('volume-level', (level: number) => {
        setVolumeLevel(level);
      });

      vapiInstance.on('message', (msg: {
        type: string;
        transcript?: string;
        transcriptType?: string;
        role?: string;
        toolCallList?: VapiToolCall[];
        toolCallResult?: VapiToolCallResult;
        status?: string;
      }) => {
        console.log('Event: message', msg);
        
        switch (msg.type) {
          case 'transcript':
            if (msg.transcriptType === 'final' && msg.transcript) {
              const speaker = msg.role === 'assistant' ? 'Assistant' : 'User';
              setTranscript(prev => `${prev}\n${speaker}: ${msg.transcript}`);
              addEventLog('Transcript', `${speaker} (Final): "${msg.transcript.substring(0, 50)}..."`, <MessageSquareText size={14} />);
            }
            break;
            
          case 'tool-calls': // Updated event name
            if (msg.toolCallList && Array.isArray(msg.toolCallList)) {
              for (const toolCall of msg.toolCallList) {
                if (toolCall.function) {
                  const { name, arguments: argsString } = toolCall.function;
                  let parameters = {};
                  try {
                    parameters = JSON.parse(argsString || '{}');
                  } catch (e) { console.error("Failed to parse tool arguments:", argsString); }

                  const newCall: FunctionCall = {
                    id: toolCall.id, // Use the ID from Vapi
                    name,
                    parameters,
                    timestamp: new Date(),
                    pending: true
                  };
                  setFunctionCalls(prev => [...prev, newCall]);
                  setTranscript(prev => `${prev}\n[Tool Call Requested] ${name}(${formatJsonForDisplay(parameters)})`);
                  addEventLog('Tool', `Calling: ${name}`, <Zap size={14} className="text-yellow-500" />);
                  addToast({ type: 'info', title: `Calling Tool: ${name}`, message: `Params: ${formatJsonForDisplay(parameters)}` });
                }
              }
            }
            break;
            
          case 'tool-calls-result': // Updated event name
            if (msg.toolCallResult) {
              const resultData = msg.toolCallResult as VapiToolCallResult;
              const toolCallId = resultData.toolCallId;
              
              // Use functional update to get the latest state
              setFunctionCalls(prevCalls => {
                const callIndex = prevCalls.findIndex(call => call.id === toolCallId);
                if (callIndex === -1) return prevCalls; // Call not found (shouldn't happen often)

                const updatedCall = { 
                  ...prevCalls[callIndex], 
                  pending: false, 
                  result: resultData.result, 
                  error: resultData.error 
                };
                
                const newCalls = [...prevCalls];
                newCalls[callIndex] = updatedCall;

                // Log and Toast based on the *updated* call info
                const functionName = updatedCall.name || 'Unknown Function';
                setTranscript(prev => 
                  `${prev}\n[Tool Result] ${functionName}: ${resultData.result || resultData.error || 'Unknown'}`
                );
                
                if (resultData.error) {
                  addEventLog('Tool', `Error: ${functionName} - ${resultData.error}`, <AlertCircle size={14} className="text-red-500" />);
                  addToast({ type: 'error', title: `Tool Error: ${functionName}`, message: resultData.error });
                } else {
                  addEventLog('Tool', `Result: ${functionName}`, <CheckCircle size={14} className="text-green-500" />);
                  addToast({ type: 'success', title: `Tool Result: ${functionName}`, message: formatJsonForDisplay(resultData.result) });
                }

                return newCalls;
              });
            }
            break;

          case 'status-update':
            if (msg.status) {
              setCallStatus(`Status: ${msg.status}`);
              addEventLog('Call Status', msg.status, <Activity size={14} className="text-purple-500" />);
            }
            break;

          case 'user-interrupted':
            console.log('User interrupted assistant');
            addEventLog('Interaction', 'User interrupted', <MicOff size={14} className="text-orange-500" />);
            addToast({ type: 'warning', title: 'Interruption', message: 'You interrupted the assistant.', duration: 3000 });
            break;
            
          case 'hang':
             console.log('Assistant hang detected');
             addEventLog('System', 'Assistant hang detected', <Loader2 size={14} className="text-yellow-500 animate-spin" />);
             addToast({ type: 'warning', title: 'Assistant Delayed', message: 'The assistant is taking a moment to respond.', duration: 4000 });
             break;
            
          default:
            // Log other potentially useful messages
            addEventLog(msg.type, JSON.stringify(msg), <Info size={14} className="text-gray-400" />);
            console.log(`Unhandled message type: ${msg.type}`);
        }
      });

      vapiInstance.on('error', (e: Error) => {
        console.error('VAPI Error:', e);
        setCallStatus(`Error: ${e.message}`);
        setIsSessionActive(false); // Ensure session is marked inactive on error
        addEventLog('Error', e.message, <AlertCircle size={14} className="text-red-500" />);
        addToast({ type: 'error', title: 'Call Error', message: e.message, duration: 8000 });
      });

      // Cleanup
      return () => {
        console.log('Cleaning up Vapi instance...');
        vapiInstance.stop();
        vapiRef.current = null;
        // Don't add log here as state might be unmounted
      };
    } catch (err) {
      console.error('Failed to initialize Vapi SDK:', err);
      setCallStatus('Error: Failed to initialize Vapi SDK');
      addToast({ 
        type: 'error', 
        title: 'SDK Initialization Error', 
        message: err instanceof Error ? err.message : String(err) 
      });
      return;
    }
  // Dependencies: Only run once on mount, include stable functions
  }, [publicKey, addToast, addEventLog, formatJsonForDisplay]); 

  // --- Action Handlers ---
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const startCallHandler = useCallback(() => {
    if (!vapiRef.current || isSessionActive) return;
    setCallStatus('Checking Permissions...');
    addEventLog('Action', 'Start Call requested', <Bot size={14} className="text-blue-500" />);

    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(stream => {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        addEventLog('Permission', 'Microphone access granted', <Mic size={14} className="text-green-500" />);
        setCallStatus('Initializing Call...');
        
        console.log('Starting call with minimal parameters');
        addToast({ type: 'info', title: 'Starting Call', message: 'Connecting...', duration: 3000 });

        // Make sure vapiRef.current exists
        if (!vapiRef.current) {
          const errorMessage = 'Vapi instance not initialized';
          setCallStatus(`Error starting call: ${errorMessage}`);
          setIsSessionActive(false);
          addEventLog('Error', `Call start failed: ${errorMessage}`, <AlertCircle size={14} className="text-red-500" />);
          addToast({ type: 'error', title: 'Call Start Failed', message: errorMessage, duration: 8000 });
          return;
        }

        try {
          // Start the call with minimal parameters - just the assistant ID
          console.log('Starting call with minimal parameters');
          
          // Start the call with proper error handling
          vapiRef.current.start(assistantId)
            .catch((e) => {
              console.error("Failed to start call:", e);
              const errorMessage = e instanceof Error ? e.message : String(e);
              setCallStatus(`Error starting call: ${errorMessage}`);
              setIsSessionActive(false);
              addEventLog('Error', `Call start failed: ${errorMessage}`, <AlertCircle size={14} className="text-red-500" />);
              addToast({ type: 'error', title: 'Call Start Failed', message: errorMessage, duration: 8000 });
            });
        } catch (error) {
          console.error("Exception during call start:", error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          setCallStatus(`Error starting call: ${errorMessage}`);
          setIsSessionActive(false);
          addEventLog('Error', `Call start exception: ${errorMessage}`, <AlertCircle size={14} className="text-red-500" />);
          addToast({ type: 'error', title: 'Call Start Failed', message: errorMessage, duration: 8000 });
        }
      })
      .catch(err => {
        console.error("Microphone permission error:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setCallStatus("Error: Microphone permission denied");
        addEventLog('Permission', 'Microphone access denied', <MicOff size={14} className="text-red-500" />);
        addToast({ type: 'error', title: 'Mic Access Denied', message: 'Please allow microphone access.', duration: 8000 });
      });
  // Dependencies: Include state and stable functions used inside
  }, [isSessionActive, addToast, addEventLog]); // Remove assistantId dependency

  const stopCallHandler = useCallback(() => {
    if (!vapiRef.current || !isSessionActive) return;
    setCallStatus('Stopping Call...');
    addEventLog('Action', 'Stop Call requested', <PhoneOff size={14} className="text-red-500" />);
    vapiRef.current.stop();
  // Dependencies: Include state and stable functions used inside
  }, [isSessionActive, addEventLog]); 

  const toggleMuteHandler = useCallback(() => {
    if (!vapiRef.current || !isSessionActive) return;
    const currentMuteState = vapiRef.current.isMuted();
    vapiRef.current.setMuted(!currentMuteState);
    setIsMuted(!currentMuteState);
    const muteStatus = !currentMuteState ? 'Muted' : 'Unmuted';
    console.log(`Microphone ${muteStatus}`);
    addEventLog('Mic', muteStatus, !currentMuteState ? <MicOff size={14} className="text-orange-500"/> : <Mic size={14} className="text-green-500"/>);
  // Dependencies: Include state and stable functions used inside
  }, [isSessionActive, addEventLog]); 

  // --- Render ---
  return (
    <div className="flex flex-col items-center justify-start min-h-screen p-4 pt-10 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <h1 className="text-3xl font-bold mb-4 text-center">Airodental Voice Assistant</h1>
      <p className="text-center text-gray-600 dark:text-gray-400 mb-6 max-w-lg">
        Talk to Claire to book your next dental appointment. Watch the logs below for real-time updates.
      </p>

      <div className="flex flex-wrap justify-center gap-3 mb-4">
        <Button onClick={startCallHandler} disabled={isSessionActive}>
          <Bot className="inline-block mr-2" size={18}/> Start Call
        </Button>
        <Button onClick={stopCallHandler} disabled={!isSessionActive} className="bg-red-600 hover:bg-red-700">
          <PhoneOff className="inline-block mr-2" size={18}/> Stop Call
        </Button>
        <Button onClick={toggleMuteHandler} disabled={!isSessionActive} className="bg-gray-600 hover:bg-gray-700">
          {isMuted ? <Mic className="inline-block mr-2" size={18}/> : <MicOff className="inline-block mr-2" size={18}/>}
          {isMuted ? 'Unmute' : 'Mute'} Mic
        </Button>
      </div>

      <StatusIndicator status={callStatus} />

      {isSessionActive && (
        <div className="w-full max-w-md mt-4 p-4 border rounded-md bg-white dark:bg-gray-800 shadow">
          <h2 className="text-lg font-semibold mb-2 text-center">Assistant Speaking Status</h2>
          <VolumeIndicator level={volumeLevel} />
          <p className="text-sm text-center mt-1 text-gray-600 dark:text-gray-400">
            {assistantIsSpeaking ? 'Speaking...' : 'Listening...'}
          </p>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-7xl mt-8 px-4">
        {/* Left Column: Transcript */}
        <div className="w-full lg:w-1/2 flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Live Transcript</h2>
          <TranscriptDisplay transcript={transcript} transcriptRef={transcriptRef} />
        </div>

        {/* Right Column: Function Calls & Event Log */}
        <div className="w-full lg:w-1/2 flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">Function Calls</h2>
            <FunctionCallsList calls={functionCalls} />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">Event Log</h2>
            <EventLogList logEntries={eventLog} />
          </div>
        </div>
      </div>

      {/* Instructions when idle */}
      {!isSessionActive && (
        <div className="mt-10 max-w-xl text-center p-4 border rounded-md bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow">
          <h2 className="text-lg font-bold mb-2 text-blue-800 dark:text-blue-200">How to Use This Demo</h2>
          <ol className="text-left list-decimal pl-6 space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <li>Click **Start Call** and grant microphone permission.</li>
            <li>Talk to Claire about booking a dental appointment.</li>
            <li>Try asking: *"Do you have any openings tomorrow afternoon?"*</li>
            <li>Provide your name and email when asked.</li>
            <li>Observe the **Live Transcript**, **Function Calls**, and **Event Log** update in real-time.</li>
            <li>Click **Stop Call** to end the conversation.</li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default DemoPage;