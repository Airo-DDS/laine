"use client";

import { useState, useEffect } from "react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, PencilIcon, Trash2Icon, Loader2 } from "lucide-react";
import type { ToolInfo, ToolUpdatePayload } from "@/app/types/vapi";
import EditToolModal from "./_components/EditToolModal";
import { Alert } from "@/components/ui/alert";

export default function ToolConfigurationPage() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTool, setEditingTool] = useState<ToolInfo | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Fetch tools on component mount
  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/tools");
      
      if (!response.ok) {
        throw new Error(`Error fetching tools: ${response.statusText}`);
      }
      
      const data = await response.json();
      setTools(data.tools || []);
    } catch (err) {
      console.error("Failed to fetch tools:", err);
      setError("Failed to load tools. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditTool = (tool: ToolInfo) => {
    setEditingTool(tool);
    setIsEditModalOpen(true);
  };

  const handleSaveTool = async (updatePayload: ToolUpdatePayload) => {
    try {
      setIsSaving(true);
      setError(null);
      
      const response = await fetch("/api/update-tool", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ updatePayload }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Error updating tool: ${response.statusText}`);
      }
      
      // Update the tool in the local state
      setTools(prevTools => 
        prevTools.map(tool => 
          tool.id === updatePayload.id 
            ? { ...tool, name: updatePayload.name || tool.name, description: updatePayload.description || tool.description }
            : tool
        )
      );
      
      // Close the modal
      setIsEditModalOpen(false);
      setEditingTool(null);
    } catch (err) {
      console.error("Failed to update tool:", err);
      setError(err instanceof Error ? err.message : "Failed to update tool");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTool = async (toolId: string) => {
    // Confirm before deleting
    if (!window.confirm("Are you sure you want to delete this tool? This action cannot be undone.")) {
      return;
    }
    
    try {
      setIsDeleting(toolId);
      setError(null);
      
      const response = await fetch("/api/delete-tool", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ toolId }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Error deleting tool: ${response.statusText}`);
      }
      
      // Remove the tool from the local state
      setTools(prevTools => prevTools.filter(tool => tool.id !== toolId));
    } catch (err) {
      console.error("Failed to delete tool:", err);
      setError(err instanceof Error ? err.message : "Failed to delete tool");
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tool Configuration</h1>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <div className="ml-3">{error}</div>
        </Alert>
      )}
      
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : tools.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p>No tools found for your organization.</p>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tools.map((tool) => (
                <TableRow key={tool.id || `${tool.name}-${tool.type}`}>
                  <TableCell className="font-medium">{tool.name}</TableCell>
                  <TableCell>{tool.type}</TableCell>
                  <TableCell className="hidden md:table-cell max-w-[400px] truncate">
                    {tool.description}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditTool(tool)}
                        disabled={!!isDeleting}
                      >
                        <PencilIcon className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteTool(tool.id as string)}
                        disabled={isDeleting === tool.id || !tool.id}
                      >
                        {isDeleting === tool.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2Icon className="h-4 w-4" />
                        )}
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      
      <EditToolModal
        tool={editingTool}
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSave={handleSaveTool}
        isLoading={isSaving}
      />
    </div>
  );
} 