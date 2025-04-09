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
import { ListTree, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface ToolInfo {
  id?: string;
  name: string;
  description?: string;
  type: string;
}

interface ToolListModalProps {
  assistantId: string;
}

export function ToolListModal({ assistantId }: ToolListModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTools = async () => {
      if (!isOpen || !assistantId) return; // Only fetch when open and ID is available

      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/get-assistant-tools?id=${assistantId}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch tools');
        }
        setTools(data.tools || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load tools');
        setTools([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTools();
  }, [isOpen, assistantId]); // Refetch when modal opens or assistantId changes

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 left-4 z-40 shadow-lg"
          aria-label="Show Assistant Tools"
        >
          <ListTree className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[350px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configured Assistant Tools</SheetTitle>
          <SheetDescription>
            List of tools available to assistant ID: {assistantId}
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
            <p className="text-center text-muted-foreground">No tools configured for this assistant.</p>
          ) : (
            <ul className="space-y-3">
              {tools.map((tool, index) => (
                <li key={tool.id || `${tool.name}-${index}`} className="border p-3 rounded-md bg-card">
                  <p className="font-semibold text-card-foreground">{tool.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">Type: {tool.type}</p>
                  {tool.id && <p className="text-xs text-muted-foreground">ID: {tool.id}</p>}
                  {tool.description && <p className="text-sm mt-2">{tool.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
} 