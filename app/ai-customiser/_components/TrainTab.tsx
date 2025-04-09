"use client";

import React, { useState } from 'react';
import { Loader2, AlertCircle, CheckCircle, UploadCloud, FileText, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface TrainTabProps {
  assistantId: string;
}

export function TrainTab({ assistantId }: TrainTabProps) {
  const [kbContent, setKbContent] = useState<string>('');
  const [filename, setFilename] = useState<string>('');
  const [toolName, setToolName] = useState<string>('');
  const [kbName, setKbName] = useState<string>('');
  const [kbDescription, setKbDescription] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [createdToolInfo, setCreatedToolInfo] = useState<{ id: string; name: string } | null>(null);

  const handleCreateKnowledgeBase = async () => {
    if (!kbContent.trim()) {
      setErrorMessage("Knowledge base content cannot be empty.");
      return;
    }
    if (!filename.trim()) {
      setErrorMessage("Filename is required.");
      return;
    }
    if (!toolName.trim()) {
      setErrorMessage("Knowledge Tool Name is required.");
      return;
    }
    if (!kbName.trim()) {
      setErrorMessage("Knowledge Base Name is required.");
      return;
    }
    if (!kbDescription.trim()) {
      setErrorMessage("Topic Description is required.");
      return;
    }

    setIsLoading(true);
    setStatusMessage('');
    setErrorMessage('');
    setCreatedToolInfo(null); // Reset previous info

    try {
      // --- 1. Upload File ---
      setStatusMessage(`Uploading file "${filename}"...`);
      const uploadRes = await fetch('/api/upload-kb-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: kbContent, filename }),
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || uploadData.error) {
        throw new Error(`File upload failed: ${uploadData.error || uploadRes.statusText}`);
      }
      const fileId = uploadData.fileId;
      setStatusMessage(`File "${filename}" uploaded successfully (ID: ${fileId}).`);
      console.log("Uploaded File ID:", fileId);

      // --- 2. Create Query Tool ---
      setStatusMessage(`Creating knowledge tool "${toolName}" for "${kbDescription}"...`);
      const createToolRes = await fetch('/api/create-query-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: [fileId], toolName, kbName, kbDescription }),
      });
      const createToolData = await createToolRes.json();
      if (!createToolRes.ok || createToolData.error) {
        throw new Error(`Knowledge tool creation failed: ${createToolData.error || createToolRes.statusText}`);
      }
      const toolId = createToolData.toolId;
      setStatusMessage(`Knowledge tool "${toolName}" created successfully (ID: ${toolId}).`);
      console.log("Created Tool ID:", toolId);

      // --- 3. Update Assistant ---
      setStatusMessage(`Attaching knowledge tool ${toolId} to assistant ${assistantId}...`);
      const updateAssistantRes = await fetch('/api/update-assistant-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantId, toolId }),
      });
      const updateAssistantData = await updateAssistantRes.json();
      if (!updateAssistantRes.ok || updateAssistantData.error) {
        throw new Error(`Assistant update failed: ${updateAssistantData.error || updateAssistantRes.statusText}`);
      }
      setStatusMessage(`Success! Knowledge tool "${toolName}" (ID: ${toolId}) attached to assistant.`);
      setCreatedToolInfo({ id: toolId, name: toolName });
      console.log("Assistant updated successfully:", updateAssistantData.assistant);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      setErrorMessage(message);
      console.error("Error in handleCreateKnowledgeBase:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <FileText className="mr-2 h-5 w-5 text-gray-600 dark:text-gray-400" /> Train Your Assistant
      </h2>

      <Alert variant="default" className="bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-300" />
        <AlertTitle className="text-blue-800 dark:text-blue-200">How Knowledge Training Works</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
          Enter information below that your assistant should learn. This knowledge will be uploaded and made available to your assistant. Remember to update your assistant&apos;s system prompt to tell it when to use this knowledge (e.g., &quot;Use your knowledge about {kbDescription || 'specific topics'} when asked.&quot;).
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div>
            <Label htmlFor="toolName">Knowledge Tool Name</Label>
            <Input
              id="toolName"
              value={toolName}
              onChange={(e) => setToolName(e.target.value)}
              placeholder="e.g., office_policies"
              className="mt-1"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">A unique technical name for this knowledge (no spaces).</p>
          </div>
          <div>
            <Label htmlFor="kbName">Knowledge Base Name</Label>
            <Input
              id="kbName"
              value={kbName}
              onChange={(e) => setKbName(e.target.value)}
              placeholder="e.g., Office_Policies"
              className="mt-1"
              disabled={isLoading}
            />
             <p className="text-xs text-gray-500 mt-1">Internal name for this knowledge set (no spaces).</p>
          </div>
      </div>
       <div>
            <Label htmlFor="kbDescription">Topic Description</Label>
            <Input
              id="kbDescription"
              value={kbDescription}
              onChange={(e) => setKbDescription(e.target.value)}
              placeholder="e.g., Office hours and appointment policies"
              className="mt-1"
              disabled={isLoading}
            />
             <p className="text-xs text-gray-500 mt-1">What topics this knowledge covers (spaces allowed).</p>
          </div>

      <div>
        <Label htmlFor="kbContent">Knowledge Content</Label>
        <Textarea
          id="kbContent"
          value={kbContent}
          onChange={(e) => setKbContent(e.target.value)}
          rows={10}
          className="mt-1 w-full font-mono text-sm"
          placeholder="Enter Q&A pairs or general information here. e.g.,&#10;Q: What are your weekend hours?&#10;A: We are closed on weekends."
          disabled={isLoading}
        />
      </div>

      <div>
        <Label htmlFor="filename">Filename</Label>
        <Input
          id="filename"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder="e.g., office_policies.txt"
          className="mt-1"
          disabled={isLoading}
        />
         <p className="text-xs text-gray-500 mt-1">A name for this knowledge file (include .txt extension).</p>
      </div>

      <Button
        onClick={handleCreateKnowledgeBase}
        disabled={isLoading || !kbContent.trim() || !filename.trim() || !toolName.trim() || !kbName.trim() || !kbDescription.trim()}
        className="w-full"
      >
        {isLoading ? (
          <Loader2 className="animate-spin mr-2 h-4 w-4" />
        ) : (
          <UploadCloud className="mr-2 h-4 w-4" />
        )}
        Upload Knowledge to Assistant
      </Button>

      {statusMessage && !errorMessage && createdToolInfo && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>
            {statusMessage} You can now reference this knowledge in your assistant&apos;s prompt using the tool name: <strong>{createdToolInfo.name}</strong>.
          </AlertDescription>
        </Alert>
      )}
      {statusMessage && !errorMessage && !createdToolInfo && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Status</AlertTitle>
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
    </div>
  );
} 