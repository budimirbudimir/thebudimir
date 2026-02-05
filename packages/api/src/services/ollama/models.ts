// OLLAMA_URL can be:
// - http://localhost:11434 (default, direct Ollama access)
// - https://localhost:8443 (HTTPS proxy for browser access from production sites)
// For production browser access, run: bun run ollama-proxy
export const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
export const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL || 'mistral-7b-instruct-v0.3-q4_k_m:custom';
export const OLLAMA_VISION_MODEL =
  process.env.OLLAMA_VISION_MODEL || 'llava-phi3:latest'; // Vision model for images (lighter than llava)

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
export function inferModelMetadata(
  modelName: string,
): { description: string; capabilities: string[] } {
  const lowerName = modelName.toLowerCase();
  const capabilities: string[] = ['text']; // All models support text

  // Vision/Multimodal models
  if (
    lowerName.includes('llava') ||
    lowerName.includes('glm') ||
    lowerName.includes('vision') ||
    lowerName.includes('qwen2-vl') ||
    lowerName.includes('qwen3-vl') ||
    lowerName.includes('multimodal')
  ) {
    capabilities.push('vision');
    capabilities.push('multimodal');
    return {
      description:
        'Multimodal model with vision and text understanding capabilities',
      capabilities,
    };
  }

  // Embedding models
  if (
    lowerName.includes('embed') ||
    lowerName.includes('nomic') ||
    lowerName.includes('mxbai')
  ) {
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
  if (
    lowerName.includes('qwen2.5') ||
    lowerName.includes('hermes') ||
    lowerName.includes('functionary')
  ) {
    capabilities.push('tools');
    return {
      description:
        'Model with strong function calling and tool use capabilities',
      capabilities,
    };
  }

  // Code-specialized models
  if (
    lowerName.includes('codestral') ||
    lowerName.includes('codegemma') ||
    lowerName.includes('deepseek-coder') ||
    lowerName.includes('qwen2.5-coder')
  ) {
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

export async function listModels(): Promise<OllamaModel[]> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      // Avoid hanging when Ollama is not running or unreachable
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      console.error('Failed to fetch Ollama models:', response.statusText);
      return [];
    }

    const data = (await response.json()) as { models?: OllamaModel[] };
    const models = data.models || [];

    // Enrich models with metadata
    return models.map((model) => {
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
