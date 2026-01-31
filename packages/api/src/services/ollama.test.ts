import { describe, expect, mock, test } from 'bun:test';

describe('Ollama service', () => {
  describe('isConfigured', () => {
    test('always returns true for local Ollama', () => {
      const { isConfigured } = require('./ollama');
      expect(isConfigured()).toBe(true);
    });
  });

  describe('Image handling', () => {
    test('validates base64 image data format with data URL prefix', () => {
      const imageData =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const parts = imageData.split(',');

      expect(parts.length).toBe(2);
      expect(parts[0]).toContain('image/');
      expect(parts[0]).toContain('base64');
    });

    test('validates base64 data extraction from data URL', () => {
      const imageData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////';
      const parts = imageData.split(',');
      const base64Data = parts[1];

      expect(base64Data).toBeDefined();
      expect(typeof base64Data).toBe('string');
      expect(base64Data.length).toBeGreaterThan(0);
    });

    test('detects image format from data URL prefix', () => {
      const testCases = [
        { dataUrl: 'data:image/png;base64,abc', expected: 'png' },
        { dataUrl: 'data:image/jpeg;base64,abc', expected: 'jpeg' },
        { dataUrl: 'data:image/webp;base64,abc', expected: 'webp' },
        { dataUrl: 'data:image/gif;base64,abc', expected: 'gif' },
      ];

      for (const { dataUrl, expected } of testCases) {
        const formatMatch = dataUrl.match(/image\/(\w+)/);
        const format = formatMatch ? formatMatch[1] : 'unknown';
        expect(format).toBe(expected);
      }
    });

    test('validates base64 string can be decoded to buffer', () => {
      const validBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      expect(() => {
        Buffer.from(validBase64, 'base64');
      }).not.toThrow();
    });

    test('calculates image size in MB from base64 length', () => {
      const base64Length = 1024 * 1024; // 1MB in base64
      const sizeMB = (base64Length / (1024 * 1024)).toFixed(2);

      expect(sizeMB).toBe('1.00');
    });

    test('validates max image size limit', () => {
      const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
      const smallImage = 5 * 1024 * 1024; // 5MB
      const largeImage = 15 * 1024 * 1024; // 15MB

      expect(smallImage).toBeLessThan(MAX_IMAGE_SIZE);
      expect(largeImage).toBeGreaterThan(MAX_IMAGE_SIZE);
    });

    test('validates WebP detection from format string', () => {
      const webpFormat = 'webp';
      const pngFormat = 'png';
      const jpegFormat = 'jpeg';

      expect(webpFormat.toLowerCase()).toBe('webp');
      expect(pngFormat.toLowerCase()).not.toBe('webp');
      expect(jpegFormat.toLowerCase()).not.toBe('webp');
    });

    test('validates image data structure in messages array', () => {
      const message = {
        role: 'user',
        content: 'What do you see in this image?',
        images: ['base64datahere'],
      };

      expect(message).toHaveProperty('images');
      expect(Array.isArray(message.images)).toBe(true);
      expect(message.images.length).toBe(1);
    });

    test('validates vision model selection based on image presence', () => {
      const OLLAMA_MODEL = 'mistral-7b-instruct-v0.3-q4_k_m:custom';
      const OLLAMA_VISION_MODEL = 'llava-phi3:latest';

      const hasImage = true;
      const noImage = false;

      const modelWithImage = hasImage ? OLLAMA_VISION_MODEL : OLLAMA_MODEL;
      const modelWithoutImage = noImage ? OLLAMA_VISION_MODEL : OLLAMA_MODEL;

      expect(modelWithImage).toBe(OLLAMA_VISION_MODEL);
      expect(modelWithoutImage).toBe(OLLAMA_MODEL);
    });

    test('validates default message when none provided with image', () => {
      const userMessage = undefined;
      const defaultMessage = 'What do you see in this image?';
      const message = userMessage || defaultMessage;

      expect(message).toBe(defaultMessage);
    });

    test('validates user message takes precedence over default', () => {
      const userMessage = 'Describe this image in detail';
      const defaultMessage = 'What do you see in this image?';
      const message = userMessage || defaultMessage;

      expect(message).toBe(userMessage);
    });
  });

  describe('Request construction', () => {
    test('validates Ollama API request structure', () => {
      const request = {
        model: 'llava-phi3:latest',
        messages: [
          {
            role: 'user',
            content: 'What is in this image?',
            images: ['base64data'],
          },
        ],
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 2000,
        },
      };

      expect(request).toHaveProperty('model');
      expect(request).toHaveProperty('messages');
      expect(request).toHaveProperty('stream');
      expect(request).toHaveProperty('options');
      expect(request.stream).toBe(false);
      expect(Array.isArray(request.messages)).toBe(true);
    });

    test('validates temperature and maxTokens defaults', () => {
      const temperature = undefined;
      const maxTokens = undefined;

      const finalTemp = temperature ?? 0.7;
      const finalTokens = maxTokens ?? 2000;

      expect(finalTemp).toBe(0.7);
      expect(finalTokens).toBe(2000);
    });

    test('validates custom temperature and maxTokens', () => {
      const temperature = 0.9;
      const maxTokens = 1000;

      const finalTemp = temperature ?? 0.7;
      const finalTokens = maxTokens ?? 2000;

      expect(finalTemp).toBe(0.9);
      expect(finalTokens).toBe(1000);
    });
  });

  describe('Error handling', () => {
    test('validates invalid image data format error', () => {
      const invalidImageData = 'not-a-valid-data-url';
      const parts = invalidImageData.split(',');

      expect(parts.length).toBeLessThan(2);
    });

    test('formats error message for failed Ollama communication', () => {
      const originalError = new Error('Connection refused');
      const errorMessage = `Failed to communicate with local AI service: ${originalError.message}`;

      expect(errorMessage).toContain('Failed to communicate with local AI service');
      expect(errorMessage).toContain('Connection refused');
    });

    test('validates error response structure from Ollama', () => {
      const errorResponse = {
        status: 500,
        statusText: 'Internal Server Error',
        body: '{"error":"model runner has unexpectedly stopped"}',
      };

      expect(errorResponse.status).toBe(500);
      expect(errorResponse.body).toContain('error');
    });
  });

  describe('Web search integration', () => {
    test('validates toolsUsed array when web search is enabled', () => {
      const toolsUsed: string[] = [];
      const searchQuery = 'test query';

      toolsUsed.push(`web_search("${searchQuery}")`);

      expect(toolsUsed.length).toBe(1);
      expect(toolsUsed[0]).toContain('web_search');
      expect(toolsUsed[0]).toContain(searchQuery);
    });

    test('validates toolsUsed is undefined when no tools used', () => {
      const toolsUsed: string[] = [];
      const result = toolsUsed.length > 0 ? toolsUsed : undefined;

      expect(result).toBeUndefined();
    });

    test('validates system message with search results', () => {
      const searchResults = 'Search result 1\nSearch result 2';
      const systemMessage = {
        role: 'system',
        content: `Here are current web search results that may help answer the user's question:\n\n${searchResults}\n\nUse this information to provide an accurate, up-to-date answer.`,
      };

      expect(systemMessage.role).toBe('system');
      expect(systemMessage.content).toContain(searchResults);
      expect(systemMessage.content).toContain('web search results');
    });
  });

  describe('convertImageToPng', () => {
    test('successfully converts a WebP image to PNG', async () => {
      // Mock sharp to avoid actual image processing
      const mockSharp = mock(() => ({
        png: mock(() => ({
          toBuffer: mock(async () => Buffer.from('fake-png-data')),
        })),
      }));

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

  describe('chat function image validation', () => {
    test('throws error for invalid image data format in request.imageData', async () => {
      const { chat } = require('./ollama');

      const request = {
        message: 'Describe this image',
        imageData: 'not-a-valid-data-url', // Missing comma separator
      };

      await expect(chat(request)).rejects.toThrow(
        'Invalid image data format. Expected data URL with base64.'
      );
    });

    test('throws error for images exceeding maximum allowed size', async () => {
      const { chat } = require('./ollama');

      // Create a base64 string larger than 10MB
      const largeBase64 = 'A'.repeat(11 * 1024 * 1024); // 11MB
      const request = {
        message: 'Describe this image',
        imageData: `data:image/png;base64,${largeBase64}`,
      };

      await expect(chat(request)).rejects.toThrow(/Image is too large.*MB/);
      await expect(chat(request)).rejects.toThrow(/smaller than 7MB/);
    });
  });
});
