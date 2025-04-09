"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigureTab } from './_components/ConfigureTab';
import { TrainTab } from './_components/TrainTab';
import { TestTab } from './_components/TestTab';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ToolListModal } from '@/components/ToolListModal';

// Define a simplified type for the config needed by ConfigureTab
export interface AssistantConfig {
  name?: string;
  model?: {
    provider?: string;
    model?: string;
    messages?: Array<{ role: string; content?: string }>;
  };
  voice?: {
    provider?: string;
    voiceId?: string;
  };
  // Add other relevant fields as needed by ConfigureTab
}

export default function AICustomiserPage() {
  const [assistantConfig, setAssistantConfig] = useState<AssistantConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

  const fetchAssistantConfig = useCallback(async () => {
    if (!assistantId) {
      setErrorMessage("Assistant ID not configured in environment variables.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(`/api/get-assistant-config?id=${assistantId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to fetch config (status: ${response.status})`);
      }
      setAssistantConfig(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error loading configuration.';
      console.error("Fetch config error:", error);
      setErrorMessage(message);
      setAssistantConfig(null); // Clear config on error
    } finally {
      setIsLoading(false);
    }
  }, [assistantId]);

  useEffect(() => {
    fetchAssistantConfig();
  }, [fetchAssistantConfig]);

  return (
    <div className="flex flex-col p-6 relative">
      <h1 className="text-2xl font-bold mb-6">AI Customiser</h1>
      {!assistantId && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Configuration Error</AlertTitle>
          <AlertDescription>
            Assistant ID is not set. Please contact your administrator.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin h-12 w-12 text-primary" />
        </div>
      ) : errorMessage ? (
         <Alert variant="destructive">
           <AlertCircle className="h-4 w-4" />
           <AlertTitle>Error Loading Configuration</AlertTitle>
           <AlertDescription>{errorMessage}</AlertDescription>
         </Alert>
      ) : assistantConfig && assistantId ? (
        <Tabs defaultValue="configure" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="configure">Configure</TabsTrigger>
            <TabsTrigger value="train">Train</TabsTrigger>
            <TabsTrigger value="test">Test</TabsTrigger>
          </TabsList>
          <TabsContent value="configure" className="mt-4">
            <ConfigureTab
              initialConfig={assistantConfig}
              assistantId={assistantId}
            />
          </TabsContent>
          <TabsContent value="train" className="mt-4">
            <TrainTab assistantId={assistantId} />
          </TabsContent>
          <TabsContent value="test" className="mt-4">
            <TestTab assistantId={assistantId} />
          </TabsContent>
        </Tabs>
      ) : (
         <p>Could not load assistant configuration.</p> // Fallback if config is null but no error message
      )}
      
      {assistantId && <ToolListModal assistantId={assistantId} />}
    </div>
  );
} 