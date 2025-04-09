"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ListTree, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// Use a more generic type for the full Vapi Tool structure
interface VapiTool {
  id?: string;
  type: string;
  function?: {
    name?: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
  description?: string;
  destinations?: string[];
  knowledgeBases?: string[];
  [key: string]: unknown; // Allow for any other properties
}

interface ToolListModalProps {
  assistantId: string;
}

export function ToolListModal({ assistantId }: ToolListModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tools, setTools] = useState<VapiTool[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTool, setExpandedTool] = useState<string | null>(null); // Track which tool detail is open

  useEffect(() => {
    const fetchTools = async () => {
      if (!isOpen || !assistantId) return; // Only fetch when open and ID is available

      setIsLoading(true);
      setError(null);
      setTools([]); // Clear previous tools
      setExpandedTool(null); // Reset expanded state
      
      try {
        console.log(`[ToolListModal] Fetching tools for assistant: ${assistantId}`);
        const response = await fetch(`/api/get-assistant-tools?id=${assistantId}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Failed to fetch tools (status: ${response.status})`);
        }
        console.log(`[ToolListModal] Received ${data.tools?.length ?? 0} tools from API.`);
        setTools(data.tools || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load tools');
        console.error("[ToolListModal] Fetch Error:", err);
        setTools([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTools();
  }, [isOpen, assistantId]); // Refetch when modal opens or assistantId changes

  const toggleExpand = (toolIdentifier: string) => {
    setExpandedTool(prev => (prev === toolIdentifier ? null : toolIdentifier));
  };

  // Helper to get a display name (prioritize function name)
  const getToolDisplayName = (tool: VapiTool): string => {
     return tool.function?.name || tool.type || 'Unnamed Tool';
  };

  // Helper to get a description (prioritize function description)
  const getToolDescription = (tool: VapiTool): string | undefined => {
     return tool.function?.description || tool.description;
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 left-4 z-40 shadow-lg rounded-full"
          aria-label="Show Assistant Tools"
        >
          <ListTree className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[90vw] max-w-[600px] sm:max-w-[700px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configured Assistant Tools</SheetTitle>
          <SheetDescription>
            Tools available to assistant ID: <code className="text-xs bg-muted px-1 py-0.5 rounded">{assistantId}</code>
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : tools.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No tools configured for this assistant.</p>
          ) : (
            <ul className="space-y-3">
              {tools.map((tool) => {
                const toolKey = tool.id || `${getToolDisplayName(tool)}-${tool.type}`; // Use ID or name as key
                const isExpanded = expandedTool === toolKey;
                return (
                  <li key={toolKey} className="border dark:border-gray-700 rounded-md overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleExpand(toolKey)}
                      className="w-full flex justify-between items-center p-3 text-left bg-card hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background"
                      aria-expanded={isExpanded}
                      aria-controls={`tool-details-${toolKey}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-card-foreground truncate">{getToolDisplayName(tool)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Type: {tool.type}</p>
                        {getToolDescription(tool) && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">{getToolDescription(tool)}</p>
                        )}
                        {tool.id && <p className="text-xs text-muted-foreground mt-1">ID: {tool.id}</p>}
                      </div>
                      {isExpanded ? 
                        <ChevronUp className="h-5 w-5 ml-2 flex-shrink-0" /> : 
                        <ChevronDown className="h-5 w-5 ml-2 flex-shrink-0" />
                      }
                    </button>

                    {/* Collapsible Content */}
                    {isExpanded && (
                      <div
                        id={`tool-details-${toolKey}`}
                        className="p-3 bg-muted/30 border-t"
                      >
                        <h4 className="text-sm font-medium mb-2 text-muted-foreground">Full Configuration:</h4>
                        <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                          <code>
                            {JSON.stringify(tool, null, 2)}
                          </code>
                        </pre>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
} 