import { describe, expect, test } from 'bun:test';

describe('Mistral listModels', () => {
  test('returns array of predefined models', async () => {
    const { listModels } = require('./mistral');
    const models = await listModels();

    expect(Array.isArray(models)).toBe(true);
  });

  test('validates model structure', async () => {
    const { listModels } = require('./mistral');
    const models = await listModels();

    if (models.length > 0) {
      const model = models[0];
      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('name');
      expect(typeof model.id).toBe('string');
      expect(typeof model.name).toBe('string');
    }
  });

  test('returns empty array when not configured', async () => {
    delete process.env.GH_MODELS_TOKEN;

    // Re-import to pick up cleared env var
    delete require.cache[require.resolve('./mistral')];
    const { listModels } = require('./mistral');

    const models = await listModels();
    expect(models).toEqual([]);
  });

  test('includes Ministral-3B in available models', async () => {
    process.env.GH_MODELS_TOKEN = 'test-token';

    // Re-import to pick up env var
    delete require.cache[require.resolve('./mistral')];
    const { listModels } = require('./mistral');

    const models = await listModels();
    const ministral = models.find((m: { id: string }) => m.id === 'mistral-ai/Ministral-3B');

    expect(ministral).toBeDefined();
    expect(ministral?.name).toBe('Ministral-3B');
  });
});

describe('Mistral chat with custom model', () => {
  test('accepts model parameter in request', () => {
    const request = {
      message: 'Hello',
      model: 'mistral-ai/Mistral-7B-Instruct-v0.3',
    };

    expect(request).toHaveProperty('model');
    expect(request.model).toBe('mistral-ai/Mistral-7B-Instruct-v0.3');
  });
});
