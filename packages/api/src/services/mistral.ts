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

export interface MistralModel {
  id: string;
  name: string;
  description?: string;
  capabilities?: string[];
}

// GitHub Models available models (as of 2024)
const AVAILABLE_MODELS: MistralModel[] = [
  {
    id: 'mistral-ai/Ministral-3B',
    name: 'Ministral-3B',
    description: 'Fast and efficient 3B parameter model',
    capabilities: ['text', 'vision', 'tools'],
  },
  {
    id: 'mistral-ai/Mistral-7B-Instruct-v0.3',
    name: 'Mistral-7B-Instruct',
    description: 'Versatile 7B parameter instruction-tuned model',
    capabilities: ['text', 'tools'],
  },
  {
    id: 'mistral-ai/Mistral-Small',
    name: 'Mistral-Small',
    description: 'Balanced performance and efficiency',
    capabilities: ['text', 'tools'],
  },
];

// Define web search tool for function calling
/**
 * Optimize image for API compatibility: resize to 800x800 max and compress
 */
async function optimizeImage(base64Data: string, format: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const image = sharp(buffer);
    const metadata = await image.metadata();

    console.log(`🔄 Optimizing image: ${metadata.width}x${metadata.height}, format=${format}`);

    // Resize to max 800x800 for better API compatibility
    const maxDimension = 800;
    let resizedImage = image;

    if (metadata.width && metadata.height) {
      if (metadata.width > maxDimension || metadata.height > maxDimension) {
        resizedImage = image.resize(maxDimension, maxDimension, {
          fit: 'inside',
          withoutEnlargement: true,
        });
        console.log(`   📐 Resizing to max ${maxDimension}px`);
      }
    }

    // Convert to JPEG with quality 85 for better compression (unless it's PNG with transparency)
    const hasAlpha = metadata.hasAlpha;
    let optimizedBuffer: Buffer;
    let finalFormat: string;

    if (hasAlpha) {
      // Keep PNG for images with transparency but optimize
      optimizedBuffer = await resizedImage
        .png({
          compressionLevel: 9,
          quality: 85,
        })
        .toBuffer();
      finalFormat = 'png';
      console.log('   💾 Optimized as PNG (transparency detected)');
    } else {
      // Convert to JPEG for better compression
      optimizedBuffer = await resizedImage
        .jpeg({
          quality: 85,
          progressive: true,
        })
        .toBuffer();
      finalFormat = 'jpeg';
      console.log('   💾 Converted to JPEG for better compression');
    }

    const optimizedBase64 = optimizedBuffer.toString('base64');
    const originalSizeMB = (base64Data.length / (1024 * 1024)).toFixed(2);
    const newSizeMB = (optimizedBase64.length / (1024 * 1024)).toFixed(2);

    console.log(`   ✅ Optimized: ${originalSizeMB}MB -> ${newSizeMB}MB`);

    return `data:image/${finalFormat};base64,${optimizedBase64}`;
  } catch (error) {
    console.error('⚠️  Image optimization failed:', error);
    throw new Error('Failed to process image. Please try a different image.');
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

export async function chat(request: ChatRequest & { model?: string }): Promise<ChatResponse> {
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

    const base64Data = parts[1];
    const formatMatch = parts[0].match(/image\/(\w+)/);
    const imageFormat = formatMatch ? formatMatch[1] : 'unknown';

    console.log(
      `🖼️  Processing image: format=${imageFormat}, size=${(base64Data.length / (1024 * 1024)).toFixed(2)}MB`
    );

    // Validate image size before processing
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    if (base64Data.length > MAX_IMAGE_SIZE) {
      const sizeMB = (base64Data.length / (1024 * 1024)).toFixed(1);
      throw new Error(
        `Image is too large (${sizeMB}MB base64). Please use an image smaller than 7MB.`
      );
    }

    // Optimize image for API compatibility (resize to 800x800 + compress)
    let imageDataUrl: string;
    try {
      imageDataUrl = await optimizeImage(base64Data, imageFormat);
    } catch (error) {
      console.error('Image optimization error:', error);
      throw error;
    }

    // Validate optimized size
    const optimizedSize = imageDataUrl.split(',')[1]?.length || 0;
    const MAX_OPTIMIZED_SIZE = 3 * 1024 * 1024; // 3MB after optimization
    if (optimizedSize > MAX_OPTIMIZED_SIZE) {
      const sizeMB = (optimizedSize / (1024 * 1024)).toFixed(1);
      throw new Error(
        `Image is still too large after optimization (${sizeMB}MB). Please use a smaller image.`
      );
    }

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
