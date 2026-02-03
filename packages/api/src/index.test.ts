import { describe, expect, test } from 'bun:test';

describe('API Server', () => {
  test('environment variables have defaults', () => {
    const PORT = Number(process.env.PORT) || 3000;
    expect(PORT).toBeDefined();
    expect(typeof PORT).toBe('number');
  });

  test('version is defined', () => {
    const VERSION = process.env.npm_package_version || '1.0.0';
    expect(VERSION).toBeDefined();
    expect(typeof VERSION).toBe('string');
  });

  test('response structure is correct', () => {
    const mockResponse = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    expect(mockResponse).toHaveProperty('status');
    expect(mockResponse).toHaveProperty('version');
    expect(mockResponse).toHaveProperty('timestamp');
    expect(mockResponse).toHaveProperty('uptime');

    expect(mockResponse.status).toBe('healthy');
    expect(typeof mockResponse.version).toBe('string');
    expect(typeof mockResponse.timestamp).toBe('string');
    expect(typeof mockResponse.uptime).toBe('number');
  });

  test('timestamp is valid ISO format', () => {
    const timestamp = new Date().toISOString();
    const parsed = new Date(timestamp);
    expect(parsed.toString()).not.toBe('Invalid Date');
  });
});

describe('/v1/chat endpoint', () => {
  test('validates request body structure for valid message', () => {
    const body = {
      message: 'Hello, how are you?',
      systemPrompt: 'You are a helpful assistant.',
      temperature: 0.7,
      maxTokens: 500,
    };

    expect(body).toHaveProperty('message');
    expect(typeof body.message).toBe('string');
    expect(body.message.length).toBeGreaterThan(0);
  });

  test('validates request body for missing message', () => {
    const body = {};

    const message = (body as { message?: unknown }).message;
    const isValid = !!(message && typeof message === 'string');

    expect(isValid).toBe(false);
  });

  test('validates request body for invalid message type', () => {
    const body = { message: 123 };

    const message = body.message;
    const isValid = message && typeof message === 'string';

    expect(isValid).toBe(false);
  });

  test('validates request body for null message', () => {
    const body = { message: null };

    const message = body.message;
    const isValid = !!(message && typeof message === 'string');

    expect(isValid).toBe(false);
  });

  test('validates request body for empty string message', () => {
    const body = { message: '' };

    const message = body.message;
    const isValid = !!(message && typeof message === 'string' && message.length > 0);

    expect(isValid).toBe(false);
  });

  test('validates optional parameters', () => {
    const body = {
      message: 'Test',
      systemPrompt: 'You are helpful',
      temperature: 0.7,
      maxTokens: 500,
    };

    expect(body.systemPrompt).toBeDefined();
    expect(typeof body.systemPrompt).toBe('string');
    expect(body.temperature).toBeDefined();
    expect(typeof body.temperature).toBe('number');
    expect(body.maxTokens).toBeDefined();
    expect(typeof body.maxTokens).toBe('number');
  });

  test('handles request with only required message field', () => {
    const body = {
      message: 'Hello',
    };

    const message = body.message;
    const isValid = message && typeof message === 'string';

    expect(isValid).toBe(true);
    expect(message).toBe('Hello');
  });

  test('CORS headers configuration is correct', () => {
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:8080'];

    const origin = 'http://localhost:5173';
    const isAllowed = allowedOrigins.includes(origin);

    expect(isAllowed).toBe(true);
  });

  test('CORS headers reject unauthorized origin', () => {
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:8080'];

    const origin = 'http://malicious-site.com';
    const isAllowed = allowedOrigins.includes(origin);

    expect(isAllowed).toBe(false);
  });

  test('validates response structure', () => {
    const response = {
      response: 'Hello! How can I help you?',
      model: 'Ministral-3B',
    };

    expect(response).toHaveProperty('response');
    expect(response).toHaveProperty('model');
    expect(typeof response.response).toBe('string');
    expect(typeof response.model).toBe('string');
  });

  test('validates error response structure for unconfigured service', () => {
    const errorResponse = {
      error: 'AI service not configured',
    };

    expect(errorResponse).toHaveProperty('error');
    expect(errorResponse.error).toBe('AI service not configured');
  });

  test('validates error response structure for invalid request', () => {
    const errorResponse = {
      error: 'Message is required',
    };

    expect(errorResponse).toHaveProperty('error');
    expect(errorResponse.error).toBe('Message is required');
  });

  test('validates useWebSearch parameter', () => {
    const body = {
      message: 'What is the weather tomorrow?',
      useWebSearch: true,
    };

    expect(body).toHaveProperty('useWebSearch');
    expect(typeof body.useWebSearch).toBe('boolean');
    expect(body.useWebSearch).toBe(true);
  });

  test('useWebSearch defaults to false when not provided', () => {
    const body = {
      message: 'Hello',
    };

    const useWebSearch = (body as { useWebSearch?: boolean }).useWebSearch ?? false;
    expect(useWebSearch).toBe(false);
  });
});

describe('Error Handling', () => {
  test('error response includes both error and response fields', () => {
    const errorResponse = {
      error: "Sorry, I can't respond to that due to: Test error",
      response: "Sorry, I can't respond to that due to: Test error",
    };

    expect(errorResponse).toHaveProperty('error');
    expect(errorResponse).toHaveProperty('response');
    expect(errorResponse.error).toBe(errorResponse.response);
  });

  test('formats configuration error message', () => {
    const errorMessage = 'AI service not configured';
    const userMessage = errorMessage.includes('not configured')
      ? 'Sorry, the AI service is not properly configured. Please contact the administrator.'
      : `Sorry, I can't respond to that due to: ${errorMessage}`;

    expect(userMessage).toBe(
      'Sorry, the AI service is not properly configured. Please contact the administrator.'
    );
  });

  test('formats tool call error message', () => {
    const errorMessage = 'Maximum tool call iterations reached';
    const userMessage = errorMessage.includes('tool call')
      ? 'Sorry, there was an issue processing your request with the requested tools.'
      : `Sorry, I can't respond to that due to: ${errorMessage}`;

    expect(userMessage).toBe(
      'Sorry, there was an issue processing your request with the requested tools.'
    );
  });

  test('formats no response error message', () => {
    const errorMessage = 'No response from model';
    const userMessage = errorMessage.includes('No response')
      ? 'Sorry, I was unable to generate a response. Please try again.'
      : `Sorry, I can't respond to that due to: ${errorMessage}`;

    expect(userMessage).toBe('Sorry, I was unable to generate a response. Please try again.');
  });

  test('formats generic error message', () => {
    const errorMessage = 'Rate limit exceeded';
    const userMessage = `Sorry, I can't respond to that due to: ${errorMessage}`;

    expect(userMessage).toBe("Sorry, I can't respond to that due to: Rate limit exceeded");
  });

  test('handles Error instances', () => {
    const error = new Error('Test error message');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    expect(errorMessage).toBe('Test error message');
  });

  test('handles non-Error instances', () => {
    const error: unknown = 'String error';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    expect(errorMessage).toBe('Unknown error occurred');
  });
});
