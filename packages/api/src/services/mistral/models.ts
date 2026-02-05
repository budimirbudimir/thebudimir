import type { MistralModel } from './types';
import { isConfigured } from './config';

// GitHub Models available models (verified via GitHub Models Marketplace)
const AVAILABLE_MODELS: MistralModel[] = [
  {
    id: 'mistral-ai/mistral-small-2503',
    name: 'Mistral Small 3.1',
    description:
      'Enhanced Mistral Small 3 with multimodal capabilities and a 128k context length',
    capabilities: ['text', 'tools'],
  },
  {
    id: 'mistral-ai/mistral-medium-2505',
    name: 'Mistral Medium 3 (25.05)',
    description:
      'Advanced LLM with state-of-the-art reasoning, knowledge, coding and vision capabilities',
    capabilities: ['text', 'tools', 'vision'],
  },
  {
    id: 'mistral-ai/Codestral-2501',
    name: 'Codestral 25.01',
    description: 'Designed for code generation, supporting 80+ programming languages',
    capabilities: ['text', 'code'],
  },
  {
    id: 'mistral-ai/Ministral-3B',
    name: 'Ministral-3B',
    description: 'State-of-the-art Small Language Model (alternative naming)',
    capabilities: ['text'],
  },
  {
    id: 'mistral-ai/Mistral-7B-Instruct-v0.3',
    name: 'Mistral 7B Instruct v0.3',
    description: 'Instruction-tuned 7B parameter model',
    capabilities: ['text'],
  },
];

export async function listModels(): Promise<MistralModel[]> {
  if (!isConfigured()) {
    return [];
  }
  // Return the predefined list of available models
  return AVAILABLE_MODELS;
}
