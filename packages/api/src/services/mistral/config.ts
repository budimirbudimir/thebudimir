import { Mistral } from '@mistralai/mistralai';

export function getGhModelsToken(): string | undefined {
  return process.env.GH_MODELS_TOKEN;
}

if (!getGhModelsToken()) {
  console.warn('Warning: GH_MODELS_TOKEN not configured. AI features will be disabled.');
}

// Initialize Mistral client for GitHub Models using the current token
export const client = new Mistral({
  apiKey: getGhModelsToken(),
  serverURL: 'https://models.github.ai/inference',
});

export function isConfigured(): boolean {
  return !!getGhModelsToken();
}
