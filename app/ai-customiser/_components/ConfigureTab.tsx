"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, Save, AlertCircle, CheckCircle, RefreshCcw, Mic, UserCog } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

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
}

interface ConfigureTabProps {
  initialConfig: AssistantConfig;
  assistantId: string;
}

// Simplified voice options based on client feedback
// This eliminates the need to show providers to end users
const voiceOptions = [
  { id: "Ali", name: "Ali", tier: "recommended" },
  { id: "Elliot", name: "Elliot", tier: "recommended" },
  { id: "Lily", name: "Lily", tier: "recommended" },
  { id: "Neha", name: "Neha", tier: "recommended" },
  { id: "Cole", name: "Cole", tier: "recommended" },
  { id: "Spencer", name: "Spencer", tier: "recommended" },
  { id: "Savannah", name: "Savannah", tier: "secondary" }
];

// Hidden from UI but needed for implementation
const llmProviders = ["openai", "google", "anthropic", "groq", "custom-llm", "vapi"];
const modelOptions: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  google: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"],
  anthropic: ["claude-3-5-sonnet-20240620", "claude-3-opus-20240229"],
  groq: ["llama3-70b-8192", "mixtral-8x7b-32768"],
  "custom-llm": ["your-custom-model-name"],
  vapi: ["workflow-model"],
};

export function ConfigureTab({ initialConfig, assistantId }: ConfigureTabProps) {
  // State for editable fields
  const [assistantName, setAssistantName] = useState<string>(initialConfig.name || '');
  const [systemPrompt, setSystemPrompt] = useState<string>(
    initialConfig.model?.messages?.find(m => m.role === 'system')?.content || ''
  );
  const [voiceId, setVoiceId] = useState<string>(initialConfig.voice?.voiceId || '');
  const [llmProvider, setLlmProvider] = useState<string>(initialConfig.model?.provider || '');
  const [llmModel, setLlmModel] = useState<string>(initialConfig.model?.model || '');
  
  // Hidden state for voice provider - always use vapi but don't show to users
  const [voiceProvider, setVoiceProvider] = useState<string>(initialConfig.voice?.provider || 'vapi');

  // State for tracking initial values for reset/dirty check
  const [initialState, setInitialState] = useState(initialConfig);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Update initial state if initialConfig changes (e.g., parent re-fetches)
  useEffect(() => {
    setInitialState(initialConfig);
    setAssistantName(initialConfig.name || '');
    setSystemPrompt(initialConfig.model?.messages?.find(m => m.role === 'system')?.content || '');
    setVoiceProvider(initialConfig.voice?.provider || 'vapi');
    setVoiceId(initialConfig.voice?.voiceId || '');
    setLlmProvider(initialConfig.model?.provider || '');
    setLlmModel(initialConfig.model?.model || '');
  }, [initialConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage('');
    setErrorMessage('');
    try {
      // Construct the payload with only the fields being managed by this tab
      const updatePayload: Partial<AssistantConfig> = {
        name: assistantName,
        model: {
          // Important: Merge with existing model config to avoid overwriting other settings like tools
          ...(initialState.model || {}), // Start with existing model config
          provider: llmProvider,
          model: llmModel,
          messages: [
            // Replace only the system message, keep others if they exist
            ...(initialState.model?.messages?.filter(m => m.role !== 'system') || []),
            { role: "system", content: systemPrompt }
          ],
        },
        voice: {
          // Important: Merge with existing voice config
          ...(initialState.voice || {}),
          provider: voiceProvider, // Always set to vapi internally
          voiceId: voiceId,
        },
      };

      const response = await fetch('/api/update-assistant-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantId, updatePayload }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to update assistant (status: ${response.status})`);
      }

      // Update initial state to reflect saved changes
      setInitialState(data.assistant); // Use the response data as the new initial state
      setStatusMessage('Configuration updated successfully!');

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error saving config.';
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setAssistantName(initialState.name || '');
    setSystemPrompt(initialState.model?.messages?.find(m => m.role === 'system')?.content || '');
    setVoiceProvider(initialState.voice?.provider || 'vapi');
    setVoiceId(initialState.voice?.voiceId || '');
    setLlmProvider(initialState.model?.provider || '');
    setLlmModel(initialState.model?.model || '');
    setStatusMessage('Changes reverted to last saved state.');
    setErrorMessage('');
  };

  const hasChanges =
    assistantName !== (initialState.name || '') ||
    systemPrompt !== (initialState.model?.messages?.find(m => m.role === 'system')?.content || '') ||
    voiceProvider !== (initialState.voice?.provider || '') ||
    voiceId !== (initialState.voice?.voiceId || '') ||
    llmProvider !== (initialState.model?.provider || '') ||
    llmModel !== (initialState.model?.model || '');

  const currentModelOptions = modelOptions[llmProvider] || [];

  return (
    <div className="space-y-8">
      {/* Identity Section */}
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
        <h2 className="text-xl font-semibold mb-4 flex items-center"><UserCog className="mr-2 h-5 w-5 text-gray-600 dark:text-gray-400" /> Identity & Persona</h2>
        <div className="mb-4">
          <Label htmlFor="assistantName">Assistant Name</Label>
          <Input
            id="assistantName"
            value={assistantName}
            onChange={(e) => setAssistantName(e.target.value)}
            className="mt-1"
            disabled={isSaving}
            placeholder="e.g., Laine"
          />
        </div>
        <div>
          <Label htmlFor="systemPrompt">System Prompt</Label>
          <Textarea
            id="systemPrompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={10}
            className="mt-1 w-full font-mono text-sm"
            placeholder="Define the assistant's role, goals, and personality..."
            disabled={isSaving}
          />
        </div>
      </section>

      {/* Voice Section - Simplified to only show voice selection */}
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
        <h2 className="text-xl font-semibold mb-4 flex items-center"><Mic className="mr-2 h-5 w-5 text-gray-600 dark:text-gray-400" /> Voice</h2>
        <div>
          <Label htmlFor="voiceId">Voice</Label>
          <Select
            value={voiceId}
            onValueChange={setVoiceId}
            disabled={isSaving}
          >
            <SelectTrigger id="voiceId" className="mt-1 w-full">
              <SelectValue placeholder="Select a voice" />
            </SelectTrigger>
            <SelectContent>
              <div className="pb-1 pt-2 px-2 text-xs font-medium text-muted-foreground">Recommended</div>
              {voiceOptions
                .filter(voice => voice.tier === "recommended")
                .map(voice => (
                  <SelectItem key={voice.id} value={voice.id}>{voice.name}</SelectItem>
                ))
              }
              <div className="pb-1 pt-2 px-2 text-xs font-medium text-muted-foreground">Additional Options</div>
              {voiceOptions
                .filter(voice => voice.tier === "secondary")
                .map(voice => (
                  <SelectItem key={voice.id} value={voice.id}>{voice.name}</SelectItem>
                ))
              }
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Model Section - Hidden from users but maintained for api compatibility */}
      <div className="hidden">
        <div>
          <Label htmlFor="llmProvider">Provider</Label>
          <Select
            value={llmProvider}
            onValueChange={(value) => { setLlmProvider(value); setLlmModel(''); }}
            disabled={isSaving}
          >
            <SelectTrigger id="llmProvider" className="mt-1">
              <SelectValue placeholder="Select LLM provider" />
            </SelectTrigger>
            <SelectContent>
              {llmProviders.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="llmModel">Model</Label>
          <Select
            value={llmModel}
            onValueChange={setLlmModel}
            disabled={isSaving || !llmProvider || currentModelOptions.length === 0}
          >
            <SelectTrigger id="llmModel" className="mt-1">
              <SelectValue placeholder={!llmProvider ? "Select provider first" : "Select model"} />
            </SelectTrigger>
            <SelectContent>
              {currentModelOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              {llmProvider && currentModelOptions.length === 0 && <SelectItem value="" disabled>No models listed for this provider</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Save/Reset Buttons and Status Messages */}
      <div className="mt-6 space-y-4">
        {statusMessage && !errorMessage && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        )}
        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isSaving || !hasChanges}
          >
            <RefreshCcw className="mr-2 h-4 w-4" /> Reset Changes
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? (
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  );
} 