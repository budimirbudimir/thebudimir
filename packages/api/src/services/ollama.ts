import sharp from 'sharp';
import type { ChatRequest, ChatResponse } from './mistral';
import { formatSearchResults, webSearch } from './search';

// ReAct-style prompt for agentic execution
const REACT_SYSTEM_PROMPT = `You are an AI assistant that can use tools to help answer questions.

For each step, you should:
1. Think about what you need to do
2. If you need information, use a tool
3. Observe the results
4. Repeat until you can provide a final answer

Available tools:
- web_search: Search the web for current information. Usage: <action tool="web_search">your search query</action>

Response format:
- To think: <think>your reasoning here</think>
- To use a tool: <action tool="tool_name">parameters</action>
- To provide final answer: <answer>your complete response to the user</answer>

IMPORTANT:
- Always wrap your final response in <answer> tags
- You may use multiple tools before answering
- If you don't need tools, go directly to <answer>
`;

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
  const capabilities: string[] = ['text']; // All models support text
  
  // Vision/Multimodal models
  if (lowerName.includes('llava') || lowerName.includes('glm') || lowerName.includes('vision') || lowerName.includes('qwen2-vl') || lowerName.includes('qwen3-vl') || lowerName.includes('multimodal')) {
    capabilities.push('vision');
    capabilities.push('multimodal');
    return {
      description: 'Multimodal model with vision and text understanding capabilities',
      capabilities,
    };
  }
  
  // Embedding models
  if (lowerName.includes('embed') || lowerName.includes('nomic') || lowerName.includes('mxbai')) {
    return {
      description: 'Text embedding model for semantic search and similarity',
      capabilities: ['embedding'],
    };
  }
  
  // Reasoning/Thinking models
  if (lowerName.includes('deepseek-r1') || lowerName.includes('qwq')) {
    capabilities.push('thinking');
    return {
      description: 'Reasoning model with chain-of-thought capabilities',
      capabilities,
    };
  }
  
  // Tool-capable models (Qwen 2.5, Hermes, etc.)
  if (lowerName.includes('qwen2.5') || lowerName.includes('hermes') || lowerName.includes('functionary')) {
    capabilities.push('tools');
    return {
      description: 'Model with strong function calling and tool use capabilities',
      capabilities,
    };
  }
  
  // Code-specialized models
  if (lowerName.includes('codestral') || lowerName.includes('codegemma') || lowerName.includes('deepseek-coder') || lowerName.includes('qwen2.5-coder')) {
    capabilities.push('code');
    return {
      description: 'Specialized model optimized for code generation and understanding',
      capabilities,
    };
  }
  
  // General purpose models
  if (lowerName.includes('mistral') || lowerName.includes('mixtral')) {
    return {
      description: 'General purpose language model for various text tasks',
      capabilities,
    };
  }
  
  if (lowerName.includes('llama')) {
    return {
      description: 'Versatile open-source language model by Meta',
      capabilities,
    };
  }
  
  if (lowerName.includes('gemma')) {
    return {
      description: 'Lightweight open model by Google for efficient inference',
      capabilities,
    };
  }
  
  if (lowerName.includes('qwen') && !lowerName.includes('qwen2.5')) {
    return {
      description: 'Multilingual model with strong reasoning capabilities',
      capabilities,
    };
  }
  
  if (lowerName.includes('phi')) {
    return {
      description: 'Compact yet capable model by Microsoft Research',
      capabilities,
    };
  }
  
  // Default for unknown models
  return {
    description: 'Local language model',
    capabilities,
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

// Parse action tags from model output
function parseAction(text: string): { tool: string; params: string } | null {
  const actionMatch = text.match(/<action\s+tool="([^"]+)">(.*?)<\/action>/s);
  if (actionMatch) {
    return { tool: actionMatch[1], params: actionMatch[2].trim() };
  }
  return null;
}

// Parse answer tags from model output
function parseAnswer(text: string): string | null {
  const answerMatch = text.match(/<answer>(.*?)<\/answer>/s);
  return answerMatch ? answerMatch[1].trim() : null;
}

// Execute a tool and return the result
async function executeTool(tool: string, params: string): Promise<string> {
  if (tool === 'web_search') {
    try {
      console.log(`🔍 ReAct: Executing web_search("${params}")`);
      const searchResults = await webSearch(params);
      return formatSearchResults(searchResults);
    } catch (error) {
      console.error('Web search failed:', error);
      return 'Error: Web search failed. Please try a different query.';
    }
  }
  return `Error: Unknown tool "${tool}"`;
}

// Make a single Ollama API call
async function ollamaChat(
  messages: Array<{ role: string; content: string | string[]; images?: string[] }>,
  modelToUse: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelToUse,
      messages,
      stream: false,
      options: { temperature, num_predict: maxTokens },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  return data.message?.content || '';
}

export async function chat(request: ChatRequest & { model?: string; maxIterations?: number }): Promise<ChatResponse> {
  const messages: Array<{ role: string; content: string | string[]; images?: string[] }> = [];
  const toolsUsed: string[] = [];

  // Use vision model if image is present, or custom model if specified
  const modelToUse = request.model
    ? request.model
    : request.imageData
      ? OLLAMA_VISION_MODEL
      : OLLAMA_MODEL;

  const temperature = request.temperature ?? 0.7;
  const maxTokens = request.maxTokens ?? 2000;
  const maxIterations = request.maxIterations ?? 5;

  // Handle image in user message
  let imageBase64: string | undefined;
  if (request.imageData) {
    const parts = request.imageData.split(',');
    if (parts.length < 2) {
      throw new Error('Invalid image data format. Expected data URL with base64.');
    }
    let base64Data = parts[1];
    const formatMatch = parts[0].match(/image\/(\w+)/);
    const imageFormat = formatMatch ? formatMatch[1] : 'unknown';

    console.log(`🖼️  Processing image: ${imageFormat}`);

    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    if (base64Data.length > MAX_IMAGE_SIZE) {
      throw new Error('Image is too large. Please use an image smaller than 7MB.');
    }

    Buffer.from(base64Data, 'base64'); // Validate
    imageBase64 = await optimizeImage(base64Data, imageFormat);
  }

  // === ReAct Mode: Use tool loop when tools are enabled ===
  if (request.useTools && !request.imageData) {
    // Build ReAct system prompt with user's custom prompt
    const systemPrompt = request.systemPrompt
      ? `${request.systemPrompt}\n\n${REACT_SYSTEM_PROMPT}`
      : REACT_SYSTEM_PROMPT;
    
    messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: request.message });

    console.log(`🤖 ReAct mode: Starting agentic loop (max ${maxIterations} iterations)`);

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      console.log(`   📍 Iteration ${iteration}/${maxIterations}`);

      const response = await ollamaChat(messages, modelToUse, temperature, maxTokens);
      
      // Check for final answer
      const answer = parseAnswer(response);
      if (answer) {
        console.log(`   ✅ Final answer received`);
        return {
          response: answer,
          model: modelToUse,
          toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
        };
      }

      // Check for action (tool call)
      const action = parseAction(response);
      if (action) {
        toolsUsed.push(`${action.tool}("${action.params}")`);
        
        // Add assistant's response with action
        messages.push({ role: 'assistant', content: response });
        
        // Execute tool and add observation
        const observation = await executeTool(action.tool, action.params);
        messages.push({ 
          role: 'user', 
          content: `<observation>${observation}</observation>\n\nBased on this information, continue reasoning or provide your final answer in <answer> tags.`
        });
        
        continue;
      }

      // No action or answer - model gave a direct response (treat as final)
      console.log(`   ⚠️ No structured tags found, treating as final response`);
      return {
        response: response,
        model: modelToUse,
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
      };
    }

    // Max iterations reached - ask for final answer
    console.log(`   ⚠️ Max iterations reached, requesting final answer`);
    messages.push({ 
      role: 'user', 
      content: 'Please provide your final answer now in <answer> tags based on what you have learned.' 
    });
    const finalResponse = await ollamaChat(messages, modelToUse, temperature, maxTokens);
    const finalAnswer = parseAnswer(finalResponse) || finalResponse;
    
    return {
      response: finalAnswer,
      model: modelToUse,
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
    };
  }

  // === Simple Mode: No ReAct loop ===
  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }

  if (imageBase64) {
    messages.push({
      role: 'user',
      content: request.message || 'What do you see in this image?',
      images: [imageBase64],
    });
    console.log(`🤖 Using vision model: ${modelToUse}`);
  } else {
    messages.push({ role: 'user', content: request.message });
  }

  console.log(`📤 Sending to Ollama (simple mode): ${modelToUse}`);

  try {
    const response = await ollamaChat(messages, modelToUse, temperature, maxTokens);
    return {
      response,
      model: modelToUse,
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
