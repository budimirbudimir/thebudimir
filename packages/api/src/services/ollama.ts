import sharp from 'sharp';
import type { ChatRequest, ChatResponse } from './mistral';
import { formatSearchResults, webSearch } from './search';

// OLLAMA_URL can be:
// - http://localhost:11434 (default, direct Ollama access)
// - https://localhost:8443 (HTTPS proxy for browser access from production sites)
// For production browser access, run: bun run ollama-proxy
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral-7b-instruct-v0.3-q4_k_m:custom';
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'llava-phi3:latest'; // Vision model for images (lighter than llava)

export interface OllamaModel {
  name: string;
  modifiedAt: string;
  size: number;
  description?: string;
  capabilities?: string[];
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameterSize?: string;
    quantizationLevel?: string;
  };
}

/**
 * Infer model capabilities and description based on model name patterns
 */
function inferModelMetadata(modelName: string): { description: string; capabilities: string[] } {
  const lowerName = modelName.toLowerCase();
  
  // Vision models
  if (lowerName.includes('llava') || lowerName.includes('glm') || lowerName.includes('vision')) {
    return {
      description: 'Multimodal model with vision and text understanding capabilities',
      capabilities: ['text', 'vision'],
    };
  }
  
  // Code-specialized models
  if (lowerName.includes('codestral') || lowerName.includes('codegemma') || lowerName.includes('deepseek-coder')) {
    return {
      description: 'Specialized model optimized for code generation and understanding',
      capabilities: ['text', 'code'],
    };
  }
  
  // General purpose models
  if (lowerName.includes('mistral') || lowerName.includes('mixtral')) {
    return {
      description: 'General purpose language model for various text tasks',
      capabilities: ['text'],
    };
  }
  
  if (lowerName.includes('llama')) {
    return {
      description: 'Versatile open-source language model by Meta',
      capabilities: ['text'],
    };
  }
  
  if (lowerName.includes('gemma')) {
    return {
      description: 'Lightweight open model by Google for efficient inference',
      capabilities: ['text'],
    };
  }
  
  if (lowerName.includes('qwen')) {
    return {
      description: 'Multilingual model with strong reasoning capabilities',
      capabilities: ['text'],
    };
  }
  
  if (lowerName.includes('phi')) {
    return {
      description: 'Compact yet capable model by Microsoft Research',
      capabilities: ['text'],
    };
  }
  
  // Default for unknown models
  return {
    description: 'Local language model',
    capabilities: ['text'],
  };
}

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

    if (hasAlpha) {
      // Keep PNG for images with transparency but optimize
      optimizedBuffer = await resizedImage
        .png({
          compressionLevel: 9,
          quality: 85,
        })
        .toBuffer();
      console.log('   💾 Optimized as PNG (transparency detected)');
    } else {
      // Convert to JPEG for better compression
      optimizedBuffer = await resizedImage
        .jpeg({
          quality: 85,
          progressive: true,
        })
        .toBuffer();
      console.log('   💾 Converted to JPEG for better compression');
    }

    const optimizedBase64 = optimizedBuffer.toString('base64');
    const originalSizeMB = (base64Data.length / (1024 * 1024)).toFixed(2);
    const newSizeMB = (optimizedBase64.length / (1024 * 1024)).toFixed(2);

    console.log(`   ✅ Optimized: ${originalSizeMB}MB -> ${newSizeMB}MB`);

    return optimizedBase64;
  } catch (error) {
    console.error('⚠️  Image optimization failed:', error);
    throw new Error('Failed to process image. Please try a different image.');
  }
}

export async function chat(request: ChatRequest & { model?: string }): Promise<ChatResponse> {
  const messages: Array<{ role: string; content: string | string[]; images?: string[] }> = [];
  const toolsUsed: string[] = [];

  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }

  // If web search is enabled, perform search and add context
  if (request.useTools) {
    try {
      console.log(`🔍 Performing web search for: "${request.message}"`);
      const searchResults = await webSearch(request.message);
      const formattedResults = formatSearchResults(searchResults);

      if (searchResults.numberOfResults > 0) {
        toolsUsed.push(`web_search("${request.message}")`);
        messages.push({
          role: 'system',
          content: `Here are current web search results that may help answer the user's question:\n\n${formattedResults}\n\nUse this information to provide an accurate, up-to-date answer.`,
        });
      }
    } catch (error) {
      console.error('Web search failed:', error);
      // Continue without search results
    }
  }

  // Handle image in user message
  if (request.imageData) {
    // Extract base64 data from data URL (remove "data:image/xxx;base64," prefix)
    const parts = request.imageData.split(',');
    if (parts.length < 2) {
      console.error('Invalid image data - parts:', parts.length);
      throw new Error('Invalid image data format. Expected data URL with base64.');
    }
    let base64Data = parts[1];

    // Detect image format from data URL prefix
    const formatMatch = parts[0].match(/image\/(\w+)/);
    const imageFormat = formatMatch ? formatMatch[1] : 'unknown';

    console.log(`🖼️  Processing image:`);
    console.log(`   - Format: ${imageFormat}`);
    console.log(`   - Data URL prefix: ${parts[0].substring(0, 50)}...`);
    console.log(
      `   - Base64 length: ${base64Data.length} chars (${(base64Data.length / (1024 * 1024)).toFixed(2)}MB)`
    );
    console.log(`   - Message: "${request.message || 'What do you see in this image?'}"`);

    // Validate image size (max 10MB of base64 data)
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    if (base64Data.length > MAX_IMAGE_SIZE) {
      const sizeMB = (base64Data.length / (1024 * 1024)).toFixed(1);
      console.error(`   ❌ Image too large: ${sizeMB}MB`);
      throw new Error(
        `Image is too large (${sizeMB}MB base64). Please use an image smaller than 7MB.`
      );
    }

    // Test if base64 is valid
    try {
      Buffer.from(base64Data, 'base64');
      console.log(`   ✅ Base64 data is valid`);
    } catch (e) {
      console.error(`   ❌ Base64 data is invalid:`, e);
      throw new Error('Invalid base64 image data');
    }

    // Optimize image for better performance (resize to 800x800 + compress)
    try {
      base64Data = await optimizeImage(base64Data, imageFormat);
    } catch (error) {
      console.error('Image optimization error:', error);
      throw error;
    }

    messages.push({
      role: 'user',
      content: request.message || 'What do you see in this image?',
      images: [base64Data], // Ollama expects array of base64 strings (without data URL prefix)
    });
  } else {
    messages.push({ role: 'user', content: request.message });
  }

  // Use vision model if image is present, or custom model if specified
  const modelToUse = request.model
    ? request.model
    : request.imageData
      ? OLLAMA_VISION_MODEL
      : OLLAMA_MODEL;

  if (request.imageData) {
    console.log(`🤖 Using vision model: ${modelToUse}`);
  }

  console.log(`📤 Sending to Ollama:`);
  console.log(`   - Model: ${modelToUse}`);
  console.log(`   - Messages: ${messages.length}`);
  console.log(`   - Has images: ${messages.some((m) => m.images)}`);
  if (request.imageData) {
    console.log(
      `   - Image count: ${messages.filter((m) => m.images).reduce((sum, m) => sum + (m.images?.length || 0), 0)}`
    );
  }

  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelToUse,
        messages,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens ?? 2000,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ollama error response:', errorText);
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = (await response.json()) as {
      message?: { content?: string };
    };

    return {
      response: data.message?.content || '',
      model: modelToUse,
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
    };
  } catch (error) {
    console.error('Ollama API call error:', error);
    throw new Error(
      `Failed to communicate with local AI service: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function listModels(): Promise<OllamaModel[]> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);

    if (!response.ok) {
      console.error('Failed to fetch Ollama models:', response.statusText);
      return [];
    }

    const data = (await response.json()) as { models?: OllamaModel[] };
    const models = data.models || [];
    
    // Enrich models with metadata
    return models.map(model => {
      const metadata = inferModelMetadata(model.name);
      return {
        ...model,
        description: metadata.description,
        capabilities: metadata.capabilities,
      };
    });
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    return [];
  }
}

export function isConfigured(): boolean {
  // Check if Ollama is available
  return true; // We assume Ollama is running locally in dev
}
