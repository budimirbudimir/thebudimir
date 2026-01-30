import { Mistral } from '@mistralai/mistralai';

const GH_MODELS_TOKEN = process.env.GH_MODELS_TOKEN;

if (!GH_MODELS_TOKEN) {
  console.warn('Warning: GH_MODELS_TOKEN not configured. AI features will be disabled.');
}

// Initialize Mistral client for GitHub Models
const client = new Mistral({
  apiKey: GH_MODELS_TOKEN,
  serverURL: 'https://models.github.ai/inference',
});

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  response: string;
  model: string;
}

export async function chat(request: ChatRequest): Promise<ChatResponse> {
  if (!GH_MODELS_TOKEN) {
    throw new Error('AI service not configured');
  }

  const messages: ChatMessage[] = [];

  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }

  messages.push({ role: 'user', content: request.message });

  const response = await client.chat.complete({
    model: 'mistral-ai/Ministral-3B',
    messages,
    temperature: request.temperature ?? 1.0,
    maxTokens: request.maxTokens ?? 1000,
    topP: 1.0,
  });

  const content = response.choices?.[0]?.message?.content;
  const responseText = typeof content === 'string' ? content : '';

  return {
    response: responseText,
    model: 'Ministral-3B',
  };
}

export function isConfigured(): boolean {
  return !!GH_MODELS_TOKEN;
}
