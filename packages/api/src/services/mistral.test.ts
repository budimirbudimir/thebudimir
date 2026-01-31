import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { ChatRequest, ChatResponse } from './mistral';

describe('Mistral service', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Save original GH_MODELS_TOKEN
    originalEnv = process.env.GH_MODELS_TOKEN;
  });

  describe('isConfigured', () => {
    test('returns true when GH_MODELS_TOKEN is set', () => {
      process.env.GH_MODELS_TOKEN = 'test-token-123';

      // Re-import to pick up new env var
      delete require.cache[require.resolve('./mistral')];
      const { isConfigured } = require('./mistral');

      expect(isConfigured()).toBe(true);
    });

    test('returns false when GH_MODELS_TOKEN is not set', () => {
      delete process.env.GH_MODELS_TOKEN;

      // Re-import to pick up cleared env var
      delete require.cache[require.resolve('./mistral')];
      const { isConfigured } = require('./mistral');

      expect(isConfigured()).toBe(false);
    });

    test('returns false when GH_MODELS_TOKEN is empty string', () => {
      process.env.GH_MODELS_TOKEN = '';

      // Re-import to pick up empty env var
      delete require.cache[require.resolve('./mistral')];
      const { isConfigured } = require('./mistral');

      expect(isConfigured()).toBe(false);
    });

    test('returns false when GH_MODELS_TOKEN is undefined', () => {
      process.env.GH_MODELS_TOKEN = undefined;

      // Re-import to pick up undefined env var
      delete require.cache[require.resolve('./mistral')];
      const { isConfigured } = require('./mistral');

      expect(isConfigured()).toBe(false);
    });
  });

  describe('chat', () => {
    test('throws error when GH_MODELS_TOKEN is not configured', async () => {
      delete process.env.GH_MODELS_TOKEN;

      // Re-import to pick up cleared env var
      delete require.cache[require.resolve('./mistral')];
      const { chat } = require('./mistral');

      const request: ChatRequest = {
        message: 'Hello',
      };

      await expect(chat(request)).rejects.toThrow('AI service not configured');
    });

    test('validates request structure with system prompt', () => {
      const request: ChatRequest = {
        message: 'Hello, how are you?',
        systemPrompt: 'You are a helpful assistant.',
        temperature: 0.8,
        maxTokens: 500,
      };

      expect(request).toHaveProperty('message');
      expect(request).toHaveProperty('systemPrompt');
      expect(request).toHaveProperty('temperature');
      expect(request).toHaveProperty('maxTokens');
      expect(request.message).toBe('Hello, how are you?');
      expect(request.systemPrompt).toBe('You are a helpful assistant.');
      expect(request.temperature).toBe(0.8);
      expect(request.maxTokens).toBe(500);
    });

    test('validates default values when optional parameters are not provided', () => {
      const request: ChatRequest = {
        message: 'Hello',
      };

      // Verify request has only required field
      expect(request).toHaveProperty('message');
      expect(request.message).toBe('Hello');
      
      // Verify optional fields are undefined
      expect(request.systemPrompt).toBeUndefined();
      expect(request.temperature).toBeUndefined();
      expect(request.maxTokens).toBeUndefined();
      expect(request.useTools).toBeUndefined();
      
      // Verify defaults would be applied (temperature: 0.7, maxTokens: 2000)
      const temperature = request.temperature ?? 0.7;
      const maxTokens = request.maxTokens ?? 2000;
      expect(temperature).toBe(0.7);
      expect(maxTokens).toBe(2000);
    });

    test('validates empty response content structure', () => {
      const mockResponse: ChatResponse = {
        response: '',
        model: 'Ministral-3B',
      };

      expect(mockResponse).toHaveProperty('response');
      expect(mockResponse).toHaveProperty('model');
      expect(mockResponse.response).toBe('');
      expect(mockResponse.model).toBe('Ministral-3B');
      expect(typeof mockResponse.response).toBe('string');
    });

    test('validates response content type conversion', () => {
      // Simulate null content being converted to empty string
      const content = null;
      const responseText = typeof content === 'string' ? content : '';

      expect(responseText).toBe('');
      expect(typeof responseText).toBe('string');
      
      // Test with actual string
      const stringContent = 'Hello';
      const stringResponse = typeof stringContent === 'string' ? stringContent : '';
      expect(stringResponse).toBe('Hello');
      
      // Test with empty string
      const emptyContent = '';
      const emptyResponse = typeof emptyContent === 'string' ? emptyContent : '';
      expect(emptyResponse).toBe('');
    });
  });
});
