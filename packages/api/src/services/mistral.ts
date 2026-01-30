import { Mistral } from '@mistralai/mistralai';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.warn('Warning: GITHUB_TOKEN not configured. AI features will be disabled.');
}

// Initialize Mistral client for GitHub Models
const client = new Mistral({
  apiKey: GITHUB_TOKEN,
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
  if (!GITHUB_TOKEN) {
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
  return !!GITHUB_TOKEN;
}
