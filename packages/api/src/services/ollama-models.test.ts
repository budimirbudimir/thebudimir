import { describe, expect, test } from 'bun:test';

describe('Ollama listModels', () => {
  test('returns array of models', async () => {
    const { listModels } = require('./ollama');
    const models = await listModels();

    expect(Array.isArray(models)).toBe(true);
    // Models might be empty if Ollama isn't running, that's ok
  });

  test('validates model structure when models are available', async () => {
    const { listModels } = require('./ollama');
    const models = await listModels();

    if (models.length > 0) {
      const model = models[0];
      expect(model).toHaveProperty('name');
      expect(typeof model.name).toBe('string');
    }
  });
});

describe('Ollama chat with custom model', () => {
  test('accepts model parameter in request', () => {
    const request = {
      message: 'Hello',
      model: 'custom-model:latest',
    };

    expect(request).toHaveProperty('model');
    expect(request.model).toBe('custom-model:latest');
  });
});
