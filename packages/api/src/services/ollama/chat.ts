import type { ChatRequest, ChatResponse } from '../mistral';
import { ollamaChat } from './client';
import { optimizeImage } from './images';
import { OLLAMA_MODEL, OLLAMA_VISION_MODEL } from './models';
import { parseAction, parseAnswer } from './parsing';
import { REACT_SYSTEM_PROMPT } from './prompt';
import { executeTool } from './tools';

export async function chat(
  request: ChatRequest & { model?: string; maxIterations?: number }
): Promise<ChatResponse> {
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
    const base64Data = parts[1];
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
          content: `<observation>${observation}</observation>\n\nBased on this information, continue reasoning or provide your final answer in <answer> tags.`,
        });

        continue;
      }

      // No action or answer - model gave a direct response (treat as final)
      console.log(`   ⚠️ No structured tags found, treating as final response`);
      return {
        response,
        model: modelToUse,
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
      };
    }

    // Max iterations reached - ask for final answer
    console.log(`   ⚠️ Max iterations reached, requesting final answer`);
    messages.push({
      role: 'user',
      content:
        'Please provide your final answer now in <answer> tags based on what you have learned.',
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
  // Add conversation history if available
  if (request.history && request.history.length > 0) {
    console.log(`📜 Adding ${request.history.length} previous messages to context`);
    for (const msg of request.history) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

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
