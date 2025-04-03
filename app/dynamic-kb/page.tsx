"use client";

import React, { useState } from 'react';
import { Loader2, AlertCircle, CheckCircle, UploadCloud } from 'lucide-react';

export default function DynamicKnowledgeBasePage() {
  const [kbContent1, setKbContent1] = useState<string>("Q: What should I do if the user says they are in pain?\nA: If the user expresses being in pain, immediately ask clarifying questions like 'Where is the pain located?' and 'On a scale of 1 to 10, how severe is the pain?'. Then, advise them to seek medical attention if the pain is severe or persistent. Do not provide medical diagnoses.");
  const [kbContent2, setKbContent2] = useState<string>("Q: What are the business hours?\nA: Our business hours are Monday to Friday, 9 AM to 5 PM Eastern Time.");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || "YOUR_ASSISTANT_ID_HERE"; // Fallback

  if (!process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID) {
      console.warn("NEXT_PUBLIC_VAPI_ASSISTANT_ID is not set in environment variables. Using placeholder.");
  }


  const handleCreateKnowledgeBase = async () => {
    setIsLoading(true);
    setStatusMessage('');
    setErrorMessage('');

    const knowledgeEntries = [
      { filename: `kb_entry_1_${Date.now()}.txt`, content: kbContent1 },
      { filename: `kb_entry_2_${Date.now()}.txt`, content: kbContent2 },
      // Add more entries if you have more text boxes
    ].filter(entry => entry.content.trim() !== ''); // Filter out empty entries

    if (knowledgeEntries.length === 0) {
      setErrorMessage("Please provide content for at least one knowledge base entry.");
      setIsLoading(false);
      return;
    }

    try {
      // --- 1. Upload Files ---
      setStatusMessage(`Uploading ${knowledgeEntries.length} knowledge base file(s)...`);
      const uploadPromises = knowledgeEntries.map(entry =>
        fetch('/api/upload-kb-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: entry.content, filename: entry.filename }),
        }).then(res => res.json())
      );

      const uploadResults = await Promise.all(uploadPromises);

      const fileIds: string[] = [];
      for (const result of uploadResults) {
        if (result.error || !result.fileId) {
          throw new Error(`Failed to upload file: ${result.error || 'Unknown error'}`);
        }
        fileIds.push(result.fileId);
      }
      setStatusMessage(`Successfully uploaded ${fileIds.length} file(s). File IDs: ${fileIds.join(', ')}`);
      console.log("Uploaded File IDs:", fileIds);

      // --- 2. Create Query Tool ---
      const toolName = `dynamic_kb_query_${Date.now()}`;
      const kbName = `dynamic_kb_${Date.now()}`;
      const kbDescription = "Dynamically created knowledge base for user queries."; // Customize as needed

      setStatusMessage(`Creating query tool "${toolName}" with knowledge base "${kbName}"...`);
      const createToolResponse = await fetch('/api/create-query-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds, toolName, kbName, kbDescription }),
      });

      const createToolResult = await createToolResponse.json();
      if (createToolResult.error || !createToolResult.toolId) {
        throw new Error(`Failed to create query tool: ${createToolResult.error || 'Unknown error'}`);
      }
      const toolId = createToolResult.toolId;
      setStatusMessage(`Successfully created query tool. Tool ID: ${toolId}`);
      console.log("Created Tool ID:", toolId);

      // --- 3. Update Assistant ---
      setStatusMessage(`Attaching tool ${toolId} to assistant ${assistantId}...`);
      const updateAssistantResponse = await fetch('/api/update-assistant-tool', {
        method: 'POST', // Using POST for simplicity, could be PATCH
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantId, toolId }),
      });

      const updateAssistantResult = await updateAssistantResponse.json();
      if (updateAssistantResult.error || !updateAssistantResult.success) {
        throw new Error(`Failed to update assistant: ${updateAssistantResult.error || 'Unknown error'}`);
      }
      setStatusMessage(`Successfully attached tool to assistant ${assistantId}!`);
      console.log("Assistant updated successfully:", updateAssistantResult.assistant);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      setErrorMessage(message);
      console.error("Error in handleCreateKnowledgeBase:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100">
        Dynamic Knowledge Base Creator
      </h1>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Enter text content below. Each text box will be saved as a separate `.txt` file and added to a new knowledge base for your assistant.
          Remember to instruct your assistant in its system prompt when to use the query tool (e.g., &quot;Use the &apos;dynamic_kb_query_...&apos; tool when the user asks about pain or business hours.&quot;).
        </p>

        {/* Knowledge Base Entry 1 */}
        <div>
          <label htmlFor="kbContent1" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Knowledge Base Entry 1 (e.g., Pain Handling)
          </label>
          <textarea
            id="kbContent1"
            rows={6}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
            value={kbContent1}
            onChange={(e) => setKbContent1(e.target.value)}
            placeholder="Enter knowledge base content here..."
          />
        </div>

        {/* Knowledge Base Entry 2 */}
        <div>
          <label htmlFor="kbContent2" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Knowledge Base Entry 2 (e.g., Business Hours)
          </label>
          <textarea
            id="kbContent2"
            rows={4}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
            value={kbContent2}
            onChange={(e) => setKbContent2(e.target.value)}
            placeholder="Enter more knowledge base content..."
          />
        </div>

        {/* Add more text areas as needed */}

        <button
          onClick={handleCreateKnowledgeBase}
          disabled={isLoading || !assistantId}
          type="button"
          className={`w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
          } transition duration-150 ease-in-out`}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin mr-2 h-4 w-4" /> Processing...
            </>
          ) : (
            <>
              <UploadCloud className="mr-2 h-4 w-4" /> Create KB, Query Tool & Update Assistant
            </>
          )}
        </button>
         {!assistantId && (
             <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center mt-2">
                 Warning: NEXT_PUBLIC_VAPI_ASSISTANT_ID is not set. Please configure it in your environment variables.
             </p>
         )}

        {/* Status & Error Messages */}
        {statusMessage && (
          <div className="mt-4 p-3 bg-green-100 dark:bg-green-900 border border-green-400 text-green-700 dark:text-green-200 rounded-md text-sm flex items-center">
            <CheckCircle className="h-4 w-4 mr-2" /> {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded-md text-sm flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" /> {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
} 