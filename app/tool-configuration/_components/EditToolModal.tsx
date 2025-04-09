"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ToolInfo, ToolUpdatePayload } from "@/app/types/vapi";

interface EditToolModalProps {
  tool: ToolInfo | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatePayload: ToolUpdatePayload) => Promise<void>;
  isLoading: boolean;
}

export default function EditToolModal({
  tool,
  isOpen,
  onOpenChange,
  onSave,
  isLoading,
}: EditToolModalProps) {
  const [name, setName] = useState<string>(tool?.name || "");
  const [description, setDescription] = useState<string>(tool?.description || "");

  // Reset form when tool changes
  useEffect(() => {
    if (tool) {
      setName(tool.name || "");
      setDescription(tool.description || "");
    }
  }, [tool]);

  const handleSave = async () => {
    if (!tool) return;

    // Create update payload - always include the type as it's required by Vapi
    const updatePayload: ToolUpdatePayload = {
      id: tool.id as string,
      type: tool.type,
      name,
      description,
    };

    // If it's a function tool, we need to update the function property
    if (tool.type === "function" && tool.function) {
      updatePayload.function = {
        ...tool.function,
        name,
        description,
      };
    }

    await onSave(updatePayload);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit Tool</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Tool Type</div>
            <div className="px-3 py-2 border rounded-md bg-muted/50">
              {tool?.type}
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">Name</label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tool name"
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">Description</label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tool description"
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
} 