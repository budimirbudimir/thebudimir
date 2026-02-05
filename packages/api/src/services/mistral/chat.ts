import { formatSearchResults, webSearch } from '../search';
import { client, isConfigured } from './config';
import { webSearchTool } from './tools';
import type { ChatMessage, ChatRequest, ChatResponse } from './types';

export async function chat(request: ChatRequest & { model?: string }): Promise<ChatResponse> {
  if (!isConfigured()) {
    throw new Error('AI service not configured');
  }

  // GitHub Models doesn't support image inputs via their API
  if (request.imageData) {
    throw new Error(
      'GitHub Models does not support image analysis. Please use an Ollama vision model (llava-phi3, glm-4.6v-flash, etc.) for image tasks.',
    );
  }

  const messages: ChatMessage[] = [];

  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }

  messages.push({ role: 'user', content: request.message });

  const toolsUsed: string[] = [];
  const maxIter = request.maxIterations ?? 5; // Prevent infinite loops
  let iterations = 0;

  while (iterations < maxIter) {
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
        `Failed to communicate with AI service: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
