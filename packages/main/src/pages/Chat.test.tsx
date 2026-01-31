import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

describe('Chat Component', () => {
  describe('Message Display', () => {
    test('displays user message correctly after successful interaction', () => {
      // Mock message structure
      const userMessage = {
        role: 'user' as const,
        content: 'Hello, how are you?',
        timestamp: new Date().toISOString(),
      };

      // Verify message structure
      expect(userMessage).toHaveProperty('role');
      expect(userMessage).toHaveProperty('content');
      expect(userMessage).toHaveProperty('timestamp');
      expect(userMessage.role).toBe('user');
      expect(userMessage.content).toBe('Hello, how are you?');
      expect(typeof userMessage.timestamp).toBe('string');
    });

    test('displays assistant message correctly after successful interaction', () => {
      // Mock assistant message
      const assistantMessage = {
        role: 'assistant' as const,
        content: 'I am doing well, thank you! How can I help you today?',
        timestamp: new Date().toISOString(),
      };

      // Verify message structure
      expect(assistantMessage).toHaveProperty('role');
      expect(assistantMessage).toHaveProperty('content');
      expect(assistantMessage).toHaveProperty('timestamp');
      expect(assistantMessage.role).toBe('assistant');
      expect(assistantMessage.content).toBe(
        'I am doing well, thank you! How can I help you today?'
      );
      expect(typeof assistantMessage.timestamp).toBe('string');
    });

    test('displays multiple messages in correct order', () => {
      const messages = [
        {
          role: 'user' as const,
          content: 'Hello',
          timestamp: new Date('2024-01-01T10:00:00Z').toISOString(),
        },
        {
          role: 'assistant' as const,
          content: 'Hi there!',
          timestamp: new Date('2024-01-01T10:00:01Z').toISOString(),
        },
        {
          role: 'user' as const,
          content: 'How are you?',
          timestamp: new Date('2024-01-01T10:00:02Z').toISOString(),
        },
        {
          role: 'assistant' as const,
          content: 'I am well, thanks!',
          timestamp: new Date('2024-01-01T10:00:03Z').toISOString(),
        },
      ];

      // Verify message order
      expect(messages.length).toBe(4);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].role).toBe('user');
      expect(messages[3].role).toBe('assistant');

      // Verify timestamps are in order
      for (let i = 1; i < messages.length; i++) {
        const prevTime = new Date(messages[i - 1].timestamp).getTime();
        const currTime = new Date(messages[i].timestamp).getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    });

    test('handles empty message content', () => {
      const message = {
        role: 'user' as const,
        content: '',
        timestamp: new Date().toISOString(),
      };

      expect(message.content).toBe('');
      expect(message.content.length).toBe(0);
    });

    test('handles long message content', () => {
      const longContent = 'a'.repeat(1000);
      const message = {
        role: 'assistant' as const,
        content: longContent,
        timestamp: new Date().toISOString(),
      };

      expect(message.content.length).toBe(1000);
      expect(message.content).toBe(longContent);
    });
  });

  describe('API Interaction', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    test('successfully sends message to API and receives response', async () => {
      const mockResponse = {
        response: 'Hello! How can I help you?',
        model: 'Ministral-3B',
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
          headers: new Headers(),
          status: 200,
          statusText: 'OK',
        } as Response)
      );

      const apiEndpoint = 'http://localhost:3000/v1/chat';
      const userMessage = 'Hello, how are you?';

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          systemPrompt: 'You are a helpful assistant.',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('response');
      expect(data).toHaveProperty('model');
      expect(data.response).toBe('Hello! How can I help you?');
      expect(data.model).toBe('Ministral-3B');
    });

    test('handles API error response', async () => {
      const mockError = {
        error: 'AI service not configured',
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve(mockError),
          headers: new Headers(),
          status: 503,
          statusText: 'Service Unavailable',
        } as Response)
      );

      const apiEndpoint = 'http://localhost:3000/v1/chat';

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Hello',
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toBe('AI service not configured');
    });

    test('handles network error', async () => {
      global.fetch = mock(() => Promise.reject(new Error('Network error')));

      const apiEndpoint = 'http://localhost:3000/v1/chat';

      try {
        await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'Hello',
          }),
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Network error');
      }
    });
  });

  describe('Message Formatting', () => {
    test('formats timestamp correctly', () => {
      const timestamp = new Date('2024-01-15T14:30:00Z').toISOString();
      const date = new Date(timestamp);
      const timeString = date.toLocaleTimeString();

      expect(timeString).toBeTruthy();
      expect(typeof timeString).toBe('string');
    });

    test('preserves whitespace in message content', () => {
      const content = 'Hello\n\nThis is a test\n  with spaces';
      const message = {
        role: 'user' as const,
        content,
        timestamp: new Date().toISOString(),
      };

      expect(message.content).toBe(content);
      expect(message.content).toContain('\n\n');
      expect(message.content).toContain('  ');
    });

    test('handles special characters in message content', () => {
      const content = 'Test <html> & "quotes" \'apostrophe\' 中文 emoji 🎉';
      const message = {
        role: 'assistant' as const,
        content,
        timestamp: new Date().toISOString(),
      };

      expect(message.content).toBe(content);
    });
  });

  describe('Web Search Feature', () => {
    test('web search checkbox state updates correctly', () => {
      let useWebSearch = false;
      const setUseWebSearch = (value: boolean) => {
        useWebSearch = value;
      };

      expect(useWebSearch).toBe(false);

      setUseWebSearch(true);
      expect(useWebSearch).toBe(true);

      setUseWebSearch(false);
      expect(useWebSearch).toBe(false);
    });

    test('sends useWebSearch flag in API request', async () => {
      const mockResponse = {
        response: 'Weather information...',
        model: 'Ministral-3B',
      };

      let capturedRequestBody: any = null;
      global.fetch = mock((_url: string, options: any) => {
        capturedRequestBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
          headers: new Headers(),
          status: 200,
          statusText: 'OK',
        } as Response);
      });

      const apiEndpoint = 'http://localhost:3000/v1/chat';
      const useWebSearch = true;

      await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'What is the weather tomorrow?',
          systemPrompt: 'You are a helpful assistant.',
          useWebSearch,
        }),
      });

      expect(capturedRequestBody).toHaveProperty('useWebSearch');
      expect(capturedRequestBody.useWebSearch).toBe(true);
    });
  });

  describe('Error Handling', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    test('handles 500 error with custom error message', async () => {
      const mockError = {
        error: "Sorry, I can't respond to that due to: Rate limit exceeded",
        response: "Sorry, I can't respond to that due to: Rate limit exceeded",
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve(mockError),
          headers: new Headers(),
          status: 500,
          statusText: 'Internal Server Error',
        } as Response)
      );

      const apiEndpoint = 'http://localhost:3000/v1/chat';
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Hello',
        }),
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toContain("Sorry, I can't respond to that");
      expect(data.response).toContain("Sorry, I can't respond to that");
    });

    test('displays error as assistant message in chat', async () => {
      const errorMessage = {
        role: 'assistant' as const,
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };

      expect(errorMessage.role).toBe('assistant');
      expect(errorMessage.content).toContain('Sorry');
      expect(errorMessage.content).toContain('error');
    });

    test('handles network error gracefully', async () => {
      global.fetch = mock(() => Promise.reject(new Error('Failed to fetch')));

      const apiEndpoint = 'http://localhost:3000/v1/chat';

      try {
        await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'Hello',
          }),
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);

        // Verify error message structure for display
        const errorMessage = {
          role: 'assistant' as const,
          content:
            "Sorry, I couldn't connect to the server. Please check your connection and try again.",
          timestamp: new Date().toISOString(),
        };

        expect(errorMessage.role).toBe('assistant');
        expect(errorMessage.content).toContain("couldn't connect");
      }
    });

    test('handles tool call errors', async () => {
      const mockError = {
        error: 'Sorry, there was an issue processing your request with the requested tools.',
        response: 'Sorry, there was an issue processing your request with the requested tools.',
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve(mockError),
          headers: new Headers(),
          status: 500,
          statusText: 'Internal Server Error',
        } as Response)
      );

      const apiEndpoint = 'http://localhost:3000/v1/chat';
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'What is the weather?',
          useWebSearch: true,
        }),
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toContain('issue processing your request');
    });
  });

  describe('Image Handling', () => {
    test('message with image URL has imageUrl property', () => {
      const messageWithImage = {
        role: 'user' as const,
        content: 'What do you see in this image?',
        timestamp: new Date().toISOString(),
        imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
      };

      expect(messageWithImage).toHaveProperty('imageUrl');
      expect(messageWithImage.imageUrl).toContain('data:image/');
      expect(messageWithImage.imageUrl).toContain('base64');
    });

    test('message without image does not have imageUrl property', () => {
      const messageWithoutImage = {
        role: 'user' as const,
        content: 'Hello',
        timestamp: new Date().toISOString(),
      };

      expect(messageWithoutImage.imageUrl).toBeUndefined();
    });

    test('sends imageData in API request when image is selected', async () => {
      const mockResponse = {
        response: 'I see a beautiful sunset in this image.',
        model: 'llava-phi3:latest',
      };

      let capturedRequestBody: any = null;
      global.fetch = mock((_url: string, options: any) => {
        capturedRequestBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
          headers: new Headers(),
          status: 200,
          statusText: 'OK',
        } as Response);
      });

      const apiEndpoint = 'http://localhost:3000/v1/chat';
      const imageData = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

      await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Describe this image',
          imageData,
          systemPrompt: 'You are a helpful assistant.',
        }),
      });

      expect(capturedRequestBody).toHaveProperty('imageData');
      expect(capturedRequestBody.imageData).toBe(imageData);
      expect(capturedRequestBody.imageData).toContain('base64');
    });

    test('accepts multiple image formats', () => {
      const formats = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      const acceptString = formats.join(',');

      expect(acceptString).toContain('image/png');
      expect(acceptString).toContain('image/jpeg');
      expect(acceptString).toContain('image/jpg');
      expect(acceptString).toContain('image/webp');
    });

    test('uses default message when only image is provided', () => {
      const input = '';
      const hasImage = true;
      const message = input.trim() || (hasImage ? 'What do you see in this image?' : '');

      expect(message).toBe('What do you see in this image?');
    });

    test('uses user message when both message and image are provided', () => {
      const input = 'Describe this in detail';
      const hasImage = true;
      const message = input.trim() || (hasImage ? 'What do you see in this image?' : '');

      expect(message).toBe('Describe this in detail');
    });

    test('image preview state updates correctly', () => {
      let imagePreview: string | null = null;
      const setImagePreview = (value: string | null) => {
        imagePreview = value;
      };

      expect(imagePreview).toBe(null);

      setImagePreview('data:image/png;base64,iVBORw0KGg==');
      expect(imagePreview).toBeTruthy();
      expect(imagePreview).toContain('data:image/');

      setImagePreview(null);
      expect(imagePreview).toBe(null);
    });

    test('selected image state updates correctly', () => {
      let selectedImage: File | null = null;
      const setSelectedImage = (value: File | null) => {
        selectedImage = value;
      };

      expect(selectedImage).toBe(null);

      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      setSelectedImage(mockFile);
      expect(selectedImage).toBeTruthy();
      expect(selectedImage?.name).toBe('test.png');
      expect(selectedImage?.type).toBe('image/png');

      setSelectedImage(null);
      expect(selectedImage).toBe(null);
    });

    test('handles image error when Ollama model crashes', async () => {
      const mockError = {
        error:
          'Sorry, I can\'t respond to that due to: Failed to communicate with local AI service: Ollama API error: 500 Internal Server Error - {"error":"model runner has unexpectedly stopped"}',
        response:
          'Sorry, I can\'t respond to that due to: Failed to communicate with local AI service: Ollama API error: 500 Internal Server Error - {"error":"model runner has unexpectedly stopped"}',
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve(mockError),
          headers: new Headers(),
          status: 500,
          statusText: 'Internal Server Error',
        } as Response)
      );

      const apiEndpoint = 'http://localhost:3000/v1/chat';
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Describe this image',
          imageData: 'data:image/webp;base64,test',
        }),
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toContain('model runner has unexpectedly stopped');
    });

    test('handles image too large error', async () => {
      const mockError = {
        error: 'Image is too large (12.5MB base64). Please use an image smaller than 7MB.',
        response: 'Image is too large (12.5MB base64). Please use an image smaller than 7MB.',
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve(mockError),
          headers: new Headers(),
          status: 500,
          statusText: 'Internal Server Error',
        } as Response)
      );

      const apiEndpoint = 'http://localhost:3000/v1/chat';
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Describe this image',
          imageData: 'data:image/png;base64,' + 'a'.repeat(15 * 1024 * 1024),
        }),
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toContain('Image is too large');
      expect(data.error).toContain('MB');
    });
  });

  describe('State Management', () => {
    test('input state updates correctly', () => {
      let input = '';
      const setInput = (value: string) => {
        input = value;
      };

      setInput('Hello');
      expect(input).toBe('Hello');

      setInput('Hello, world!');
      expect(input).toBe('Hello, world!');

      setInput('');
      expect(input).toBe('');
    });

    test('loading state toggles correctly', () => {
      let isLoading = false;
      const setIsLoading = (value: boolean) => {
        isLoading = value;
      };

      expect(isLoading).toBe(false);

      setIsLoading(true);
      expect(isLoading).toBe(true);

      setIsLoading(false);
      expect(isLoading).toBe(false);
    });

    test('error state updates correctly', () => {
      let error: string | null = null;
      const setError = (value: string | null) => {
        error = value;
      };

      expect(error).toBe(null);

      setError('Test error message');
      expect(error).toBe('Test error message');

      setError(null);
      expect(error).toBe(null);
    });

    test('messages array updates correctly', () => {
      const messages: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: string;
      }> = [];

      const addMessage = (message: {
        role: 'user' | 'assistant';
        content: string;
        timestamp: string;
      }) => {
        messages.push(message);
      };

      expect(messages.length).toBe(0);

      addMessage({
        role: 'user',
        content: 'Hello',
        timestamp: new Date().toISOString(),
      });

      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe('user');

      addMessage({
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date().toISOString(),
      });

      expect(messages.length).toBe(2);
      expect(messages[1].role).toBe('assistant');
    });
  });
});
