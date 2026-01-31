import { Mistral } from '@mistralai/mistralai';
import sharp from 'sharp';
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
/**
 * Convert image to PNG format if it's WebP or other potentially unsupported formats
 */
async function convertImageToPng(base64Data: string): Promise<string> {
  try {
    // Decode base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    console.log('🔄 Converting WebP image to PNG for compatibility...');

    // Convert to PNG using sharp
    const pngBuffer = await sharp(buffer)
      .png({
        compressionLevel: 6, // Balance between speed and size
        adaptiveFiltering: true,
      })
      .toBuffer();

    const pngBase64 = pngBuffer.toString('base64');
    const originalSizeMB = (base64Data.length / (1024 * 1024)).toFixed(2);
    const newSizeMB = (pngBase64.length / (1024 * 1024)).toFixed(2);

    console.log(`   ✅ Converted WebP to PNG: ${originalSizeMB}MB -> ${newSizeMB}MB`);

    return pngBase64;
  } catch (error) {
    console.error('⚠️  Image conversion failed, using original:', error);
    return base64Data; // Return original on error
  }
}

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
    // Extract base64 data and detect format
    const parts = request.imageData.split(',');
    if (parts.length < 2) {
      throw new Error('Invalid image data format. Expected data URL with base64.');
    }

    let base64Data = parts[1];
    const formatMatch = parts[0].match(/image\/(\w+)/);
    const imageFormat = formatMatch ? formatMatch[1] : 'unknown';

    console.log(
      `🖼️  Processing image: format=${imageFormat}, size=${(base64Data.length / (1024 * 1024)).toFixed(2)}MB`
    );

    // Validate image size
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    if (base64Data.length > MAX_IMAGE_SIZE) {
      const sizeMB = (base64Data.length / (1024 * 1024)).toFixed(1);
      throw new Error(
        `Image is too large (${sizeMB}MB base64). Please use an image smaller than 7MB.`
      );
    }

    // Convert WebP to PNG if needed
    if (imageFormat.toLowerCase() === 'webp') {
      base64Data = await convertImageToPng(base64Data);
    }

    // Reconstruct data URL with potentially converted image
    const imageDataUrl =
      imageFormat.toLowerCase() === 'webp'
        ? `data:image/png;base64,${base64Data}`
        : request.imageData;

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
            url: imageDataUrl, // base64 data URL (converted if needed)
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
