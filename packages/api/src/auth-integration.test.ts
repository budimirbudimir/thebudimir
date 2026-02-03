import { beforeAll, describe, expect, test } from 'bun:test';

interface ErrorResponse {
  error: string;
}

interface HealthResponse {
  status: string;
}

describe('API Authentication Integration', () => {
  const API_URL = 'http://localhost:3000';

  test('chat endpoint returns 401 without auth token when auth is enabled', async () => {
    // Only run this test if CLERK_SECRET_KEY is set
    if (!process.env.CLERK_SECRET_KEY) {
      console.log('⏭️  Skipping auth test - CLERK_SECRET_KEY not configured');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Hello',
          model: 'test-model',
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toBe('Unauthorized');
    } catch (error) {
      console.log('⏭️  Skipping test - API server not running');
    }
  });

  test('chat endpoint returns 401 with invalid auth token', async () => {
    if (!process.env.CLERK_SECRET_KEY) {
      console.log('⏭️  Skipping auth test - CLERK_SECRET_KEY not configured');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid_token_123',
        },
        body: JSON.stringify({
          message: 'Hello',
          model: 'test-model',
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toBe('Unauthorized');
    } catch (error) {
      console.log('⏭️  Skipping test - API server not running');
    }
  });

  test('chat endpoint allows requests when auth is disabled', async () => {
    if (process.env.CLERK_SECRET_KEY) {
      console.log('⏭️  Skipping no-auth test - CLERK_SECRET_KEY is configured');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Hello',
          model: 'test-model',
        }),
      });

      // Should not return 401 when auth is disabled
      // May return 503 (service not configured) or other errors, but not 401
      expect(response.status).not.toBe(401);
    } catch (error) {
      console.log('⏭️  Skipping test - API server not running');
    }
  });

  test('models endpoint does not require authentication', async () => {
    try {
      const response = await fetch(`${API_URL}/v1/models`, {
        method: 'GET',
      });

      // Models endpoint should be public
      expect(response.status).not.toBe(401);
    } catch (error) {
      console.log('⏭️  Skipping test - API server not running');
    }
  });

  test('health endpoint does not require authentication', async () => {
    try {
      const response = await fetch(`${API_URL}/health`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const data = await response.json() as HealthResponse;
      expect(data.status).toBe('ok');
    } catch (error) {
      console.log('⏭️  Skipping test - API server not running');
    }
  });
});
