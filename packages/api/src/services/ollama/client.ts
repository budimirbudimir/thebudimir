import { OLLAMA_URL } from './models';

// Make a single Ollama API call
export async function ollamaChat(
  messages: Array<{ role: string; content: string | string[]; images?: string[] }>,
  modelToUse: string,
  temperature: number,
  maxTokens: number,
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
