export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  imageUrl?: string;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  model?: string;
  service?: string;
  temperature: number;
  maxTokens: number;
  maxIterations: number;
  tools: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  agentId?: string;
  title: string;
  model?: string;
  service?: string;
  isPrivate?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  size?: number;
  capabilities?: string[];
}

export interface ModelsResponse {
  ollama: ModelInfo[];
  ghmodels: ModelInfo[];
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  coordinatorAgentId: string;
  memberAgentIds: string[];
  executionMode: 'sequential' | 'parallel';
  createdAt: string;
  updatedAt: string;
}

export interface TeamExecuteResult {
  response: string;
  team: string;
  coordinator: string;
  steps: Array<{ agent: string; action: string; result: string }>;
  toolsUsed: string[];
}
