import type { ChatRequest, ChatResponse } from './mistral';
import { formatSearchResults, webSearch } from './search';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral-7b-instruct-v0.3-q4_k_m:custom';

export async function chat(request: ChatRequest): Promise<ChatResponse> {
  const messages: Array<{ role: string; content: string }> = [];
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

  messages.push({ role: 'user', content: request.message });

  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens ?? 2000,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      message?: { content?: string };
    };

    return {
      response: data.message?.content || '',
      model: OLLAMA_MODEL,
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
