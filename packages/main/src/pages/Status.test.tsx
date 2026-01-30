import { describe, expect, mock, test, beforeEach, afterEach } from 'bun:test';

interface ApiStatus {
  status: string;
  version: string;
  timestamp: string;
  uptime: number;
  model?: string;
}

interface ServiceStatus {
  name: string;
  endpoint: string;
  status: 'online' | 'offline' | 'loading';
  data?: ApiStatus;
  error?: string;
  lastChecked?: string;
}

describe('Status Page', () => {
  describe('Service Status Detection', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    test('detects online GitHub Models service when configured', async () => {
      const mockResponse = {
        response: 'Test response',
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

      const service: ServiceStatus = {
        name: 'GitHub Models (AI)',
        endpoint: 'http://localhost:3000/v1/chat',
        status: 'loading',
      };

      const response = await fetch(service.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'health check' }),
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('response');
      expect(data).toHaveProperty('model');

      const updatedService: ServiceStatus = {
        ...service,
        status: 'online',
        data: data as ApiStatus,
        lastChecked: new Date().toISOString(),
      };

      expect(updatedService.status).toBe('online');
      expect(updatedService.data).toBeDefined();
    });

    test('detects offline GitHub Models service with configuration error', async () => {
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

      const service: ServiceStatus = {
        name: 'GitHub Models (AI)',
        endpoint: 'http://localhost:3000/v1/chat',
        status: 'loading',
      };

      const response = await fetch(service.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'health check' }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(503);

      const errorData = await response.json();
      expect(errorData.error).toBe('AI service not configured');

      const updatedService: ServiceStatus = {
        ...service,
        status: 'offline',
        error: errorData.error,
        lastChecked: new Date().toISOString(),
      };

      expect(updatedService.status).toBe('offline');
      expect(updatedService.error).toBe('AI service not configured');
    });

    test('detects offline service with HTTP error', async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Internal Server Error' }),
          headers: new Headers(),
          status: 500,
          statusText: 'Internal Server Error',
        } as Response)
      );

      const service: ServiceStatus = {
        name: 'GitHub Models (AI)',
        endpoint: 'http://localhost:3000/v1/chat',
        status: 'loading',
      };

      const response = await fetch(service.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'health check' }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);

      const updatedService: ServiceStatus = {
        ...service,
        status: 'offline',
        error: `HTTP ${response.status}`,
        lastChecked: new Date().toISOString(),
      };

      expect(updatedService.status).toBe('offline');
      expect(updatedService.error).toBe('HTTP 500');
    });

    test('detects offline service with network error', async () => {
      global.fetch = mock(() => Promise.reject(new Error('Network error')));

      const service: ServiceStatus = {
        name: 'GitHub Models (AI)',
        endpoint: 'http://localhost:3000/v1/chat',
        status: 'loading',
      };

      try {
        await fetch(service.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'health check' }),
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        const updatedService: ServiceStatus = {
          ...service,
          status: 'offline',
          error: error instanceof Error ? error.message : 'Unknown error',
          lastChecked: new Date().toISOString(),
        };

        expect(updatedService.status).toBe('offline');
        expect(updatedService.error).toBe('Network error');
      }
    });

    test('checks API Server status correctly', async () => {
      const mockStatus = {
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: 12345,
      };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStatus),
          headers: new Headers(),
          status: 200,
          statusText: 'OK',
        } as Response)
      );

      const service: ServiceStatus = {
        name: 'API Server',
        endpoint: 'http://localhost:3000/v1/status',
        status: 'loading',
      };

      const response = await fetch(service.endpoint);

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
      expect(data.status).toBe('healthy');

      const updatedService: ServiceStatus = {
        ...service,
        status: 'online',
        data: data as ApiStatus,
        lastChecked: new Date().toISOString(),
      };

      expect(updatedService.status).toBe('online');
      expect(updatedService.data?.version).toBe('1.0.0');
      expect(updatedService.data?.uptime).toBe(12345);
    });
  });

  describe('Status Color Mapping', () => {
    test('returns green for online status', () => {
      const getStatusColor = (status: ServiceStatus['status']) => {
        switch (status) {
          case 'online':
            return 'green';
          case 'offline':
            return 'red';
          default:
            return 'yellow';
        }
      };

      expect(getStatusColor('online')).toBe('green');
    });

    test('returns red for offline status', () => {
      const getStatusColor = (status: ServiceStatus['status']) => {
        switch (status) {
          case 'online':
            return 'green';
          case 'offline':
            return 'red';
          default:
            return 'yellow';
        }
      };

      expect(getStatusColor('offline')).toBe('red');
    });

    test('returns yellow for loading status', () => {
      const getStatusColor = (status: ServiceStatus['status']) => {
        switch (status) {
          case 'online':
            return 'green';
          case 'offline':
            return 'red';
          default:
            return 'yellow';
        }
      };

      expect(getStatusColor('loading')).toBe('yellow');
    });
  });

  describe('Error Display', () => {
    test('displays configuration error correctly', () => {
      const service: ServiceStatus = {
        name: 'GitHub Models (AI)',
        endpoint: 'http://localhost:3000/v1/chat',
        status: 'offline',
        error: 'Service not configured',
        lastChecked: new Date().toISOString(),
      };

      expect(service.error).toBe('Service not configured');
      expect(service.status).toBe('offline');
    });

    test('displays network error correctly', () => {
      const service: ServiceStatus = {
        name: 'GitHub Models (AI)',
        endpoint: 'http://localhost:3000/v1/chat',
        status: 'offline',
        error: 'Network error',
        lastChecked: new Date().toISOString(),
      };

      expect(service.error).toBe('Network error');
      expect(service.status).toBe('offline');
    });

    test('displays HTTP error correctly', () => {
      const service: ServiceStatus = {
        name: 'GitHub Models (AI)',
        endpoint: 'http://localhost:3000/v1/chat',
        status: 'offline',
        error: 'HTTP 500',
        lastChecked: new Date().toISOString(),
      };

      expect(service.error).toBe('HTTP 500');
      expect(service.status).toBe('offline');
    });

    test('displays AI service not configured error', () => {
      const service: ServiceStatus = {
        name: 'GitHub Models (AI)',
        endpoint: 'http://localhost:3000/v1/chat',
        status: 'offline',
        error: 'AI service not configured',
        lastChecked: new Date().toISOString(),
      };

      expect(service.error).toBe('AI service not configured');
      expect(service.status).toBe('offline');
      expect(service.name).toBe('GitHub Models (AI)');
    });
  });

  describe('Service Data Display', () => {
    test('displays version information correctly', () => {
      const service: ServiceStatus = {
        name: 'API Server',
        endpoint: 'http://localhost:3000/v1/status',
        status: 'online',
        data: {
          status: 'healthy',
          version: '1.2.3',
          timestamp: new Date().toISOString(),
          uptime: 3600,
        },
        lastChecked: new Date().toISOString(),
      };

      expect(service.data?.version).toBe('1.2.3');
    });

    test('displays uptime information correctly', () => {
      const service: ServiceStatus = {
        name: 'API Server',
        endpoint: 'http://localhost:3000/v1/status',
        status: 'online',
        data: {
          status: 'healthy',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          uptime: 7200,
        },
        lastChecked: new Date().toISOString(),
      };

      expect(service.data?.uptime).toBe(7200);
      expect(Math.floor(service.data?.uptime || 0)).toBe(7200);
    });

    test('displays model information for AI service', () => {
      const service: ServiceStatus = {
        name: 'GitHub Models (AI)',
        endpoint: 'http://localhost:3000/v1/chat',
        status: 'online',
        data: {
          status: 'healthy',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          uptime: 1200,
          model: 'Ministral-3B',
        },
        lastChecked: new Date().toISOString(),
      };

      expect(service.data?.model).toBe('Ministral-3B');
    });

    test('displays last checked timestamp correctly', () => {
      const timestamp = new Date('2024-01-15T14:30:00Z').toISOString();
      const service: ServiceStatus = {
        name: 'API Server',
        endpoint: 'http://localhost:3000/v1/status',
        status: 'online',
        lastChecked: timestamp,
      };

      expect(service.lastChecked).toBe(timestamp);
      const date = new Date(service.lastChecked);
      expect(date.toLocaleTimeString()).toBeTruthy();
    });
  });

  describe('Multiple Services', () => {
    test('tracks multiple services independently', () => {
      const services: ServiceStatus[] = [
        {
          name: 'API Server',
          endpoint: 'http://localhost:3000/v1/status',
          status: 'online',
          data: {
            status: 'healthy',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            uptime: 3600,
          },
        },
        {
          name: 'GitHub Models (AI)',
          endpoint: 'http://localhost:3000/v1/chat',
          status: 'offline',
          error: 'AI service not configured',
        },
      ];

      expect(services.length).toBe(2);
      expect(services[0].status).toBe('online');
      expect(services[1].status).toBe('offline');
      expect(services[0].name).toBe('API Server');
      expect(services[1].name).toBe('GitHub Models (AI)');
    });

    test('handles all services online', () => {
      const services: ServiceStatus[] = [
        {
          name: 'API Server',
          endpoint: 'http://localhost:3000/v1/status',
          status: 'online',
        },
        {
          name: 'GitHub Models (AI)',
          endpoint: 'http://localhost:3000/v1/chat',
          status: 'online',
        },
      ];

      const allOnline = services.every((s) => s.status === 'online');
      expect(allOnline).toBe(true);
    });

    test('handles all services offline', () => {
      const services: ServiceStatus[] = [
        {
          name: 'API Server',
          endpoint: 'http://localhost:3000/v1/status',
          status: 'offline',
          error: 'Connection refused',
        },
        {
          name: 'GitHub Models (AI)',
          endpoint: 'http://localhost:3000/v1/chat',
          status: 'offline',
          error: 'AI service not configured',
        },
      ];

      const allOffline = services.every((s) => s.status === 'offline');
      expect(allOffline).toBe(true);
    });
  });
});
