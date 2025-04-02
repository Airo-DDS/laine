"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import type { FC } from 'react';
import { default as VapiImpl } from '@vapi-ai/web';
import { Mic, MicOff, PhoneOff, Bot, Loader2 } from 'lucide-react';

// --- UI Components (Using basic HTML, replace with Shadcn if desired) ---
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
    className={`px-4 py-2 border rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 ${className}`}
  >
    {children}
  </button>
);

const StatusIndicator = ({ status }: { status: string }) => (
  <div className="mt-4 p-2 border rounded bg-gray-100 dark:bg-gray-800">
    <strong>Status:</strong> {status}
  </div>
);

const TranscriptDisplay = ({ transcript }: { transcript: string }) => (
  <div className="mt-4 p-2 border rounded h-72 overflow-y-auto bg-gray-50 dark:bg-gray-700 font-mono text-sm">
    <pre className="whitespace-pre-wrap">{transcript}</pre>
  </div>
);

const VolumeIndicator = ({ level }: { level: number }) => (
  <div className="w-full h-2 bg-gray-300 rounded mt-2">
    <div
      className="h-full bg-green-500 rounded"
      style={{ width: `${level * 100}%`, transition: 'width 0.1s linear' }}
    />
  </div>
);

interface FunctionCall {
  name: string;
  parameters: Record<string, unknown>;
  timestamp: Date;
  result?: string;
  error?: string;
  pending: boolean;
}

const FunctionCallsList = ({ calls }: { calls: FunctionCall[] }) => {
  if (calls.length === 0) return null;
  
  return (
    <div className="mt-4 w-full max-w-md">
      <h2 className="text-xl font-semibold mb-2">Function Calls</h2>
      <div className="space-y-3">
        {calls.map((call) => (
          <div key={`${call.name}-${call.timestamp.getTime()}`} className="p-3 border rounded bg-gray-50 dark:bg-gray-800">
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-blue-600">{call.name}</h3>
              <span className="text-xs text-gray-500">{call.timestamp.toLocaleTimeString()}</span>
            </div>
            <div className="mt-1 text-sm">
              <div className="font-mono bg-gray-100 dark:bg-gray-900 p-1 rounded text-xs overflow-x-auto">
                {JSON.stringify(call.parameters, null, 2)}
              </div>
              
              {call.pending && (
                <div className="flex items-center mt-2 text-amber-600">
                  <Loader2 className="animate-spin mr-2" size={16}/>
                  Processing...
                </div>
              )}
              
              {call.result && (
                <div className="mt-2">
                  <span className="font-semibold">Result:</span>
                  <div className="font-mono bg-green-50 dark:bg-green-900/20 p-1 rounded text-xs mt-1">
                    {call.result}
                  </div>
                </div>
              )}
              
              {call.error && (
                <div className="mt-2">
                  <span className="font-semibold text-red-600">Error:</span>
                  <div className="font-mono bg-red-50 dark:bg-red-900/20 text-red-600 p-1 rounded text-xs mt-1">
                    {call.error}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
// --- End UI Components ---

const DemoPage: FC = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState<string>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [assistantIsSpeaking, setAssistantIsSpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [functionCalls, setFunctionCalls] = useState<FunctionCall[]>([]);
  const vapiRef = useRef<VapiImpl | null>(null);

  const assistantId = '5ddeb40e-9013-47f3-b980-2091e6b9269e';
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;

  // Initialize Vapi instance
  useEffect(() => {
    if (!publicKey) {
      console.error('VAPI Public Key is not set in environment variables.');
      setCallStatus('Error: Missing Public Key');
      return;
    }
    const vapiInstance = new VapiImpl(publicKey);
    vapiRef.current = vapiInstance;

    // --- Event Listeners ---
    vapiInstance.on('call-start', () => {
      console.log('Call has started');
      setCallStatus('Call Started');
      setIsSessionActive(true);
      setTranscript(''); // Reset transcript on new call
      setFunctionCalls([]); // Reset function calls on new call
    });

    vapiInstance.on('call-end', () => {
      console.log('Call has ended');
      setCallStatus('Call Ended');
      setIsSessionActive(false);
      setAssistantIsSpeaking(false);
      setVolumeLevel(0);
    });

    vapiInstance.on('speech-start', () => {
      console.log('Assistant speech has started.');
      setAssistantIsSpeaking(true);
    });

    vapiInstance.on('speech-end', () => {
      console.log('Assistant speech has ended.');
      setAssistantIsSpeaking(false);
    });

    vapiInstance.on('volume-level', (level: number) => {
      // console.log(`Assistant volume level: ${level}`); // Can be noisy
      setVolumeLevel(level);
    });

    vapiInstance.on('message', (message: {
      type: string;
      transcript?: string;
      transcriptType?: string;
      role?: string;
      functionCall?: {
        name: string;
        parameters: Record<string, unknown>;
      };
      functionResult?: {
        toolCallId?: string;
        result?: string;
        error?: string;
      };
    }) => {
      console.log('Received message:', message);
      
      if (message.type === 'transcript' && !message.role) {
        const { transcript, transcriptType } = message;
        setTranscript(prev =>
          transcriptType === 'final'
            ? `${prev}\nUser: ${transcript}` // Append final transcript
            : prev // Or update based on partial if needed
        );
      } else if (message.type === 'transcript' && message.role === 'assistant') {
        const { transcript, transcriptType } = message;
        setTranscript(prev =>
          transcriptType === 'final'
            ? `${prev}\nAssistant: ${transcript}` // Append final transcript
            : prev // Or update based on partial if needed
        );
      } else if (message.type === 'function-call' && message.functionCall) {
        // Add function call to the list
        const { name, parameters } = message.functionCall;
        const functionCall: FunctionCall = {
          name,
          parameters,
          timestamp: new Date(),
          pending: true
        };
        
        setFunctionCalls(prev => [...prev, functionCall]);
        setTranscript(prev => 
          `${prev}\n[Function Call] ${name}(${JSON.stringify(parameters, null, 2)})`
        );
      } else if (message.type === 'function-result' && message.functionResult) {
        // Update the corresponding function call with the result
        setFunctionCalls(prev => {
          const updated = [...prev];
          const lastCallIndex = updated.length - 1;
          
          if (lastCallIndex >= 0) {
            updated[lastCallIndex] = {
              ...updated[lastCallIndex],
              pending: false,
              result: message.functionResult?.result,
              error: message.functionResult?.error
            };
          }
          
          return updated;
        });
        
        setTranscript(prev => 
          `${prev}\n[Function Result] ${message.functionResult?.result || message.functionResult?.error || 'Unknown'}`
        );
      }
    });

    vapiInstance.on('error', (e: Error) => {
      console.error('VAPI Error:', e);
      setCallStatus(`Error: ${e.message}`);
      setIsSessionActive(false);
    });

    // Cleanup function
    return () => {
      vapiInstance.stop();
      vapiRef.current = null;
    };
  }, [publicKey]); // Re-run effect if publicKey changes

  const startCallHandler = useCallback(() => {
    if (!vapiRef.current) return;
    setCallStatus('Initializing Call...');

    // --- Assistant Overrides Example ---
    const assistantOverrides = {
      recordingEnabled: false, // Example override
      variableValues: {
        name: 'John', // Value for {{name}} placeholder
        // Add other variables your assistant expects here
      },
    };
    // --- End Assistant Overrides ---

    console.log('Starting call with Assistant ID:', assistantId);
    vapiRef.current.start(assistantId, assistantOverrides)
      .then(() => {
         console.log("Call start initiated successfully.");
         // Call status will be updated by the 'call-start' event listener
      })
      .catch((e) => {
        console.error("Failed to start call:", e);
        setCallStatus(`Error starting call: ${e.message}`);
        setIsSessionActive(false);
      });
  }, []);

  const stopCallHandler = useCallback(() => {
    if (!vapiRef.current) return;
    setCallStatus('Stopping Call...');
    vapiRef.current.stop();
  }, []);

  const toggleMuteHandler = useCallback(() => {
    if (!vapiRef.current) return;
    const currentMuteState = vapiRef.current.isMuted();
    vapiRef.current.setMuted(!currentMuteState);
    setIsMuted(!currentMuteState);
    console.log(`Microphone muted: ${!currentMuteState}`);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <h1 className="text-3xl font-bold mb-6">Airodental Voice Assistant Demo</h1>

      <div className="flex space-x-4 mb-4">
        <Button onClick={startCallHandler} disabled={isSessionActive}>
          <Bot className="inline-block mr-2" size={18}/> Start Call
        </Button>
        <Button onClick={stopCallHandler} disabled={!isSessionActive}>
          <PhoneOff className="inline-block mr-2" size={18}/> Stop Call
        </Button>
        <Button onClick={toggleMuteHandler} disabled={!isSessionActive}>
          {isMuted ? <Mic className="inline-block mr-2" size={18}/> : <MicOff className="inline-block mr-2" size={18}/>}
          {isMuted ? 'Unmute' : 'Mute'} Mic
        </Button>
      </div>

      <StatusIndicator status={callStatus} />

      {isSessionActive && (
        <div className="w-full max-w-md mt-4">
          <h2 className="text-xl font-semibold mb-2">Assistant Speaking Status</h2>
          <VolumeIndicator level={volumeLevel} />
          <p className="text-sm text-center mt-1">
            {assistantIsSpeaking ? 'Assistant is speaking...' : 'Assistant is listening...'}
          </p>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 w-full max-w-6xl mt-6">
        {isSessionActive && (
          <div className="w-full md:w-1/2">
            <h2 className="text-xl font-semibold mb-2">Live Transcript</h2>
            <TranscriptDisplay transcript={transcript} />
          </div>
        )}

        {isSessionActive && (
          <div className="w-full md:w-1/2">
            <FunctionCallsList calls={functionCalls} />
          </div>
        )}
      </div>

      {!isSessionActive && (
        <div className="mt-8 max-w-xl text-center">
          <h2 className="text-xl font-bold mb-2">How to Use This Demo</h2>
          <ol className="text-left list-decimal pl-6 space-y-2">
            <li>Click &quot;Start Call&quot; to initiate a conversation with Claire, our AI receptionist.</li>
            <li>Speak naturally through your microphone to interact with the assistant.</li>
            <li>Try asking about appointment availability (e.g., &quot;Do you have any appointments available tomorrow?&quot;).</li>
            <li>Follow the assistant&apos;s prompts to book an appointment with your name and email.</li>
            <li>The transcript and function calls panels will show you what&apos;s happening behind the scenes.</li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default DemoPage;