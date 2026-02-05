export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  toolCallId?: string;
}

export interface ChatRequest {
  message: string;
  imageData?: string; // base64 data URL
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  maxIterations?: number; // Max ReAct loop iterations for agentic execution
  useTools?: boolean;
}

export interface ChatResponse {
  response: string;
  model: string;
  toolsUsed?: string[];
}

export interface MistralModel {
  id: string;
  name: string;
  description?: string;
  capabilities?: string[];
}
