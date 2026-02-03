import { Mistral } from '@mistralai/mistralai';
import { formatSearchResults, webSearch } from './search';

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

// GitHub Models available models (verified via GitHub Models Marketplace)
const AVAILABLE_MODELS: MistralModel[] = [
  {
    id: 'azureml-mistral/mistral-small-2503',
    name: 'Mistral Small 3.1',
    description: 'Enhanced Mistral Small 3 with multimodal capabilities and a 128k context length',
    capabilities: ['text', 'tools'],
  },
  {
    id: 'azureml-mistral/mistral-medium-2505',
    name: 'Mistral Medium 3 (25.05)',
    description: 'Advanced LLM with state-of-the-art reasoning, knowledge, coding and vision capabilities',
    capabilities: ['text', 'tools', 'vision'],
  },
  {
    id: 'azureml-mistral/Ministral-3B',
    name: 'Ministral-3B',
    description: 'State-of-the-art Small Language Model optimized for edge computing and on-device applications',
    capabilities: ['text'],
  },
  {
    id: 'azureml-mistral/Codestral-2501',
    name: 'Codestral 25.01',
    description: 'Designed for code generation, supporting 80+ programming languages',
    capabilities: ['text', 'code'],
  },
  {
    id: 'mistral-ai/Ministral-3B',
    name: 'Ministral-3B',
    description: 'State-of-the-art Small Language Model (alternative naming)',
    capabilities: ['text'],
  },
  {
    id: 'mistral-ai/Mistral-7B-Instruct-v0.3',
    name: 'Mistral 7B Instruct v0.3',
    description: 'Instruction-tuned 7B parameter model',
    capabilities: ['text'],
  },
];

// Define web search tool for function calling
const webSearchTool = {
  type: 'function' as const,
  function: {
    name: 'web_search',
    description:
      'Search the web for current information, news, facts, or any information not in your training data. Use this when you need up-to-date or specific information.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to look up on the web',
        },
      },
      required: ['query'],
    },
  },
};

export async function chat(request: ChatRequest & { model?: string }): Promise<ChatResponse> {
  if (!GH_MODELS_TOKEN) {
    throw new Error('AI service not configured');
  }

  // GitHub Models doesn't support image inputs via their API
  if (request.imageData) {
    throw new Error(
      'GitHub Models does not support image analysis. Please use an Ollama vision model (llava-phi3, glm-4.6v-flash, etc.) for image tasks.'
    );
  }

  const messages: ChatMessage[] = [];

  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }

  messages.push({ role: 'user', content: request.message });

  const toolsUsed: string[] = [];
  const maxIterations = 5; // Prevent infinite loops
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    const modelToUse = request.model || 'mistral-ai/Ministral-3B';

    let response: Awaited<ReturnType<typeof client.chat.complete>>;
    try {
      response = await client.chat.complete({
        model: modelToUse,
        messages: messages as any,
        temperature: request.temperature ?? 0.7,
        maxTokens: request.maxTokens ?? 2000,
        tools: request.useTools !== false ? [webSearchTool] : undefined,
        toolChoice: request.useTools !== false ? 'auto' : undefined,
      });
    } catch (error) {
      console.error('API call error:', error);
      throw new Error(
        `Failed to communicate with AI service: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error('No response from model');
    }

    const message = choice.message;

    // Check if model wants to use a tool
    if (message.toolCalls && message.toolCalls.length > 0) {
      // Add assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: null,
        toolCalls: message.toolCalls as any,
      });

      // Execute each tool call
      for (const toolCall of message.toolCalls) {
        if (toolCall.function.name === 'web_search') {
          try {
            const argsString =
              typeof toolCall.function.arguments === 'string'
                ? toolCall.function.arguments
                : JSON.stringify(toolCall.function.arguments);
            const args = JSON.parse(argsString);
            const query = args.query;

            console.log(`🔍 Executing web search: "${query}"`);
            toolsUsed.push(`web_search("${query}")`);

            const searchResults = await webSearch(query);
            const formattedResults = formatSearchResults(searchResults);

            // Add tool result to messages
            messages.push({
              role: 'tool',
              content: formattedResults,
              toolCallId: toolCall.id,
            });
          } catch (error) {
            console.error('Tool execution error:', error);
            messages.push({
              role: 'tool',
              content: 'Error: Failed to execute web search',
              toolCallId: toolCall.id,
            });
          }
        }
      }

      // Continue the loop to get the final response
      continue;
    }

    // No more tool calls, return the final response
    const content = message.content;
    const responseText = typeof content === 'string' ? content : '';

    return {
      response: responseText,
      model: 'Ministral-3B',
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
    };
  }

  throw new Error('Maximum tool call iterations reached');
}

export async function listModels(): Promise<MistralModel[]> {
  if (!GH_MODELS_TOKEN) {
    return [];
  }
  // Return the predefined list of available models
  return AVAILABLE_MODELS;
}

export function isConfigured(): boolean {
  return !!GH_MODELS_TOKEN;
}
