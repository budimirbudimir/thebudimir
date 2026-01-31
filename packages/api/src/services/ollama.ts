import sharp from 'sharp';
import type { ChatRequest, ChatResponse } from './mistral';
import { formatSearchResults, webSearch } from './search';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral-7b-instruct-v0.3-q4_k_m:custom';
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'llava-phi3:latest'; // Vision model for images (lighter than llava)

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

export async function chat(request: ChatRequest): Promise<ChatResponse> {
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

    // Convert WebP to PNG if needed
    if (imageFormat.toLowerCase() === 'webp') {
      base64Data = await convertImageToPng(base64Data);
    }

    messages.push({
      role: 'user',
      content: request.message || 'What do you see in this image?',
      images: [base64Data], // Ollama expects array of base64 strings (without data URL prefix)
    });
  } else {
    messages.push({ role: 'user', content: request.message });
  }

  // Use vision model if image is present
  const modelToUse = request.imageData ? OLLAMA_VISION_MODEL : OLLAMA_MODEL;

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

export function isConfigured(): boolean {
  // Check if Ollama is available
  return true; // We assume Ollama is running locally in dev
}
