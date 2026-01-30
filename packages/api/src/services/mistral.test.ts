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

    test('constructs messages correctly with system prompt', async () => {
      process.env.GH_MODELS_TOKEN = 'test-token';
      
      // Mock the Mistral client
      const mockComplete = mock(() =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: 'Test response',
              },
            },
          ],
        })
      );

      const mockMistral = {
        chat: {
          complete: mockComplete,
        },
      };

      mock.module('@mistralai/mistralai', () => ({
        Mistral: function () {
          return mockMistral;
        },
      }));

      // Re-import to use mocked module
      delete require.cache[require.resolve('./mistral')];
      const { chat } = require('./mistral');

      const request: ChatRequest = {
        message: 'Hello, how are you?',
        systemPrompt: 'You are a helpful assistant.',
        temperature: 0.8,
        maxTokens: 500,
      };

      const response: ChatResponse = await chat(request);

      expect(response).toHaveProperty('response');
      expect(response).toHaveProperty('model');
      expect(response.model).toBe('Ministral-3B');
      expect(mockComplete).toHaveBeenCalledTimes(1);
    });

    test('uses default values when optional parameters are not provided', async () => {
      process.env.GH_MODELS_TOKEN = 'test-token';
      
      const mockComplete = mock(() =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: 'Default response',
              },
            },
          ],
        })
      );

      const mockMistral = {
        chat: {
          complete: mockComplete,
        },
      };

      mock.module('@mistralai/mistralai', () => ({
        Mistral: function () {
          return mockMistral;
        },
      }));

      delete require.cache[require.resolve('./mistral')];
      const { chat } = require('./mistral');

      const request: ChatRequest = {
        message: 'Hello',
      };

      await chat(request);

      // Verify default values are used (temperature: 1.0, maxTokens: 1000)
      const callArgs = mockComplete.mock.calls[0][0];
      expect(callArgs.temperature).toBe(1.0);
      expect(callArgs.maxTokens).toBe(1000);
    });

    test('handles empty response content gracefully', async () => {
      process.env.GH_MODELS_TOKEN = 'test-token';
      
      const mockComplete = mock(() =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: '',
              },
            },
          ],
        })
      );

      const mockMistral = {
        chat: {
          complete: mockComplete,
        },
      };

      mock.module('@mistralai/mistralai', () => ({
        Mistral: function () {
          return mockMistral;
        },
      }));

      delete require.cache[require.resolve('./mistral')];
      const { chat } = require('./mistral');

      const request: ChatRequest = {
        message: 'Test',
      };

      const response = await chat(request);
      expect(response.response).toBe('');
    });

    test('handles non-string content by returning empty string', async () => {
      process.env.GH_MODELS_TOKEN = 'test-token';
      
      const mockComplete = mock(() =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: null,
              },
            },
          ],
        })
      );

      const mockMistral = {
        chat: {
          complete: mockComplete,
        },
      };

      mock.module('@mistralai/mistralai', () => ({
        Mistral: function () {
          return mockMistral;
        },
      }));

      delete require.cache[require.resolve('./mistral')];
      const { chat } = require('./mistral');

      const request: ChatRequest = {
        message: 'Test',
      };

      const response = await chat(request);
      expect(response.response).toBe('');
    });
  });
});
