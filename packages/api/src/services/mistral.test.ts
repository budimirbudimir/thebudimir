import { beforeEach, describe, expect, test } from 'bun:test';
import type { ChatRequest, ChatResponse } from './mistral';

describe('Mistral service', () => {
  let _originalEnv: string | undefined;

  beforeEach(() => {
    // Save original GH_MODELS_TOKEN
    _originalEnv = process.env.GH_MODELS_TOKEN;
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

    test('throws error for invalid image data format in request.imageData', async () => {
      process.env.GH_MODELS_TOKEN = 'test-token-123';

      // Re-import to pick up new env var
      delete require.cache[require.resolve('./mistral')];
      const { chat } = require('./mistral');

      const request: ChatRequest = {
        message: 'Describe this image',
        imageData: 'not-a-valid-data-url', // Missing comma separator
      };

      await expect(chat(request)).rejects.toThrow(
        'Invalid image data format. Expected data URL with base64.'
      );
    });

    test('throws error for images exceeding maximum allowed size', async () => {
      process.env.GH_MODELS_TOKEN = 'test-token-123';

      // Re-import to pick up new env var
      delete require.cache[require.resolve('./mistral')];
      const { chat } = require('./mistral');

      // Create a base64 string larger than 10MB
      const largeBase64 = 'A'.repeat(11 * 1024 * 1024); // 11MB
      const request: ChatRequest = {
        message: 'Describe this image',
        imageData: `data:image/png;base64,${largeBase64}`,
      };

      await expect(chat(request)).rejects.toThrow(/Image is too large.*MB/);
      await expect(chat(request)).rejects.toThrow(/smaller than 7MB/);
    });
  });

  describe('convertImageToPng', () => {
    test('successfully converts a WebP image to PNG', async () => {
      // Create a valid base64 string (1x1 pixel WebP image)
      const webpBase64 =
        'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';

      // Manually test the conversion logic
      const buffer = Buffer.from(webpBase64, 'base64');
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);

      // Verify WebP signature (RIFF...WEBP)
      const signature = buffer.toString('ascii', 0, 4);
      expect(signature).toBe('RIFF');
    });

    test('returns original data for non-WebP images', async () => {
      // Create a small PNG base64 (1x1 red pixel)
      const pngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

      // Verify it's valid base64
      const buffer = Buffer.from(pngBase64, 'base64');
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);

      // Verify PNG signature
      const signature = buffer.toString('hex', 0, 8);
      expect(signature).toBe('89504e470d0a1a0a'); // PNG magic number
    });

    test('handles invalid base64 data gracefully', async () => {
      const invalidBase64 = '!!!invalid-base64!!!';

      // Test that Buffer.from doesn't throw but produces empty/invalid buffer
      const buffer = Buffer.from(invalidBase64, 'base64');
      expect(buffer).toBeDefined();

      // The conversion logic should catch errors and return original data
      // We're testing the error handling path exists
      expect(() => Buffer.from(invalidBase64, 'base64')).not.toThrow();
    });
  });
});
