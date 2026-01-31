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

export async function chat(request: ChatRequest): Promise<ChatResponse> {
  if (!GH_MODELS_TOKEN) {
    throw new Error('AI service not configured');
  }

  const messages: ChatMessage[] = [];

  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }

  // Handle image in user message
  if (request.imageData) {
    // Mistral expects images in content array format
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: request.message,
        },
        {
          type: 'image_url',
          image_url: {
            url: request.imageData, // base64 data URL
          },
        },
      ] as any,
    } as any);
  } else {
    messages.push({ role: 'user', content: request.message });
  }

  const toolsUsed: string[] = [];
  const maxIterations = 5; // Prevent infinite loops
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    let response: Awaited<ReturnType<typeof client.chat.complete>>;
    try {
      response = await client.chat.complete({
        model: 'mistral-ai/Ministral-3B',
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

export function isConfigured(): boolean {
  return !!GH_MODELS_TOKEN;
}
