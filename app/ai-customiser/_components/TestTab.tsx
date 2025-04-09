"use client";

import React, { useState, useEffect } from 'react';
import Vapi from '@vapi-ai/web';
import { Mic, MicOff, Play, Square, Loader2, AlertCircle, Bot } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface TestTabProps {
  assistantId: string;
}

export function TestTab({ assistantId }: TestTabProps) {
  const [assistant, setAssistant] = useState<Vapi | null>(null);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [lastTranscript, setLastTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

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
      setLastTranscript('');
    });
    assistant.on('call-end', () => {
      console.log('Test Call Ended');
      setIsSessionActive(false);
      setIsConnecting(false);
      setIsMuted(false); // Reset mute state on call end
    });
    assistant.on('message', (message) => {
      if (message.type === 'transcript' && message.transcriptType === 'final') {
        setLastTranscript(`${message.role}: ${message.transcript}`);
      }
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
    setLastTranscript('');
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

      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded min-h-[50px]">
        <p className="text-sm text-gray-600 dark:text-gray-300">Last Transcript:</p>
        <p className="font-mono text-sm mt-1">{lastTranscript || (isSessionActive ? "Waiting for speech..." : "Call not active.")}</p>
      </div>
    </div>
  );
} 