// Type definitions for Vapi tools

export interface ToolInfo {
  id?: string; // ID might not exist for transient tools
  name: string;
  description?: string;
  type: string; // e.g., 'function', 'query', 'transferCall'
  function?: {
    name?: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
  destinations?: string[]; // For transferCall tools
  knowledgeBases?: string[]; // For query tools
}

// Simplified interface for update payload
export interface ToolUpdatePayload {
  id: string;
  type: string; // Required for PATCH requests
  name?: string;
  description?: string;
  function?: {
    name?: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
  destinations?: string[]; // For transferCall tools
  knowledgeBases?: string[]; // For query tools
} 