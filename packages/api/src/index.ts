import * as mistral from './services/mistral';

const PORT = process.env.PORT || 3000;
const VERSION = process.env.npm_package_version || '1.0.0';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'http://localhost:5173', // Vite dev server
  'http://localhost:8080', // Production nginx
  process.env.FRONTEND_URL, // Production domain from env
].filter(Boolean);

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Health check endpoint
    if (url.pathname === '/v1/status') {
      return Response.json(
        {
          status: 'healthy',
          version: VERSION,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        },
        { headers: corsHeaders }
      );
    }

    // Chat endpoint
    if (url.pathname === '/v1/chat' && req.method === 'POST') {
      if (!mistral.isConfigured()) {
        return Response.json(
          { error: 'AI service not configured' },
          { status: 503, headers: corsHeaders }
        );
      }

      try {
        const body = (await req.json()) as {
          message?: unknown;
          systemPrompt?: string;
          temperature?: number;
          maxTokens?: number;
        };
        const { message, systemPrompt, temperature, maxTokens } = body;

        if (!message || typeof message !== 'string') {
          return Response.json(
            { error: 'Message is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        const response = await mistral.chat({
          message,
          systemPrompt,
          temperature,
          maxTokens,
        });

        return Response.json(response, { headers: corsHeaders });
      } catch (error) {
        console.error('Chat error:', error);
        return Response.json(
          { error: 'Failed to process chat request' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // 404 for all other routes
    return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
  },
});

console.log(`🚀 API server running on http://localhost:${server.port}`);
console.log(`📍 Health check: http://localhost:${server.port}/api/v1/status`);
