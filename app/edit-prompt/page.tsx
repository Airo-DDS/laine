"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, AlertCircle, CheckCircle, RefreshCcw } from 'lucide-react';

export default function EditAssistantPromptPage() {
  const [initialPrompt, setInitialPrompt] = useState<string>('');
  const [editedPrompt, setEditedPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start loading initially
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Get Assistant ID from public env var for display/confirmation
  const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

  // Fetch the current prompt when the component mounts
  const fetchCurrentPrompt = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage('');
    setErrorMessage('');
    try {
      const response = await fetch('/api/get-assistant-prompt');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to fetch prompt (status: ${response.status})`);
      }

      const prompt = data.prompt || ''; // Handle case where prompt might be null/undefined
      setInitialPrompt(prompt);
      setEditedPrompt(prompt);
      setStatusMessage('Current prompt loaded.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error fetching prompt.';
      console.error("Fetch prompt error:", error);
      setErrorMessage(message);
      setInitialPrompt(''); // Clear prompts on error
      setEditedPrompt('');
    } finally {
      setIsLoading(false);
    }
  }, []); // No dependencies, runs once on mount

  useEffect(() => {
    if (!assistantId) {
        setErrorMessage("Error: NEXT_PUBLIC_VAPI_ASSISTANT_ID is not set in environment variables.");
        setIsLoading(false);
        return;
    }
    fetchCurrentPrompt();
  }, [assistantId, fetchCurrentPrompt]); // Re-fetch if assistantId changes (though unlikely with env var)

  // Handle saving the updated prompt
  const handleUpdatePrompt = async () => {
    if (!assistantId) {
        setErrorMessage("Cannot update: Assistant ID is missing.");
        return;
    }
    setIsSaving(true);
    setStatusMessage('');
    setErrorMessage('');
    try {
      const response = await fetch('/api/update-assistant-prompt', {
        method: 'POST', // Using POST to send data
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantId: assistantId, newPrompt: editedPrompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to update prompt (status: ${response.status})`);
      }

      // Update the 'initialPrompt' to reflect the newly saved state
      setInitialPrompt(editedPrompt);
      setStatusMessage('System prompt updated successfully!');
      console.log("Update successful:", data.assistant); // Log updated assistant data

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error updating prompt.';
      console.error("Update prompt error:", error);
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle resetting the text area to the last fetched prompt
  const handleReset = () => {
    setEditedPrompt(initialPrompt);
    setStatusMessage('Editor reset to last loaded prompt.');
    setErrorMessage('');
  };

  const hasChanges = editedPrompt !== initialPrompt;

  return (
    <div className="container mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <h1 className="text-3xl font-bold mb-2 text-center text-gray-800 dark:text-gray-100">
        Edit Assistant System Prompt
      </h1>
      {assistantId ? (
        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">
          Assistant ID: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{assistantId}</code>
        </p>
      ) : (
         <div className="my-4 p-3 bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 text-yellow-700 dark:text-yellow-200 rounded-md text-sm flex items-center justify-center">
            <AlertCircle className="h-4 w-4 mr-2" /> NEXT_PUBLIC_VAPI_ASSISTANT_ID is not configured. Cannot load or save prompt.
         </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4">
        <label htmlFor="systemPrompt" className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
          System Prompt
        </label>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="animate-spin h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
        ) : (
          <textarea
            id="systemPrompt"
            rows={15}
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100 text-sm font-mono"
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            placeholder="Enter system prompt here..."
            disabled={!assistantId} // Disable if ID is missing
          />
        )}

        {/* Status & Error Messages */}
        {statusMessage && !errorMessage && (
          <div className="mt-4 p-3 bg-green-100 dark:bg-green-900 border border-green-400 text-green-700 dark:text-green-200 rounded-md text-sm flex items-center">
            <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" /> {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded-md text-sm flex items-center">
            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" /> {errorMessage}
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-4">
           <button
            onClick={handleReset}
            disabled={isLoading || isSaving || !hasChanges}
            type="button"
            className={`flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out`}
          >
            <RefreshCcw className="mr-2 h-4 w-4" /> Reset Changes
          </button>
          <button
            onClick={handleUpdatePrompt}
            disabled={isLoading || isSaving || !hasChanges || !assistantId}
            type="button"
            className={`flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
            } disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out`}
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin mr-2 h-4 w-4" /> Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Update Prompt
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 