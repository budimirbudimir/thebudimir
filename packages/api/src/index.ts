import * as mistral from './services/mistral';
import * as ollama from './services/ollama';

const USE_LOCAL_MODEL = process.env.NODE_ENV !== 'production' && !process.env.USE_GH_MODELS;
const aiService = USE_LOCAL_MODEL ? ollama : mistral;

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
      if (!aiService.isConfigured()) {
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
          useTools?: boolean;
          useWebSearch?: boolean;
        };
        const { message, systemPrompt, temperature, maxTokens, useTools, useWebSearch } = body;

        if (!message || typeof message !== 'string') {
          return Response.json(
            { error: 'Message is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        const response = await aiService.chat({
          message,
          systemPrompt,
          temperature,
          maxTokens,
          useTools: useWebSearch ?? useTools,
        });

        return Response.json(response, { headers: corsHeaders });
      } catch (error) {
        console.error('Chat error:', error);
        
        // Provide a more helpful error message
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const userMessage = errorMessage.includes('not configured')
          ? 'Sorry, the AI service is not properly configured. Please contact the administrator.'
          : errorMessage.includes('tool call')
          ? 'Sorry, there was an issue processing your request with the requested tools.'
          : errorMessage.includes('No response')
          ? 'Sorry, I was unable to generate a response. Please try again.'
          : `Sorry, I can't respond to that due to: ${errorMessage}`;
        
        return Response.json(
          { 
            error: userMessage,
            response: userMessage // Also include as response for consistent handling
          },
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
console.log(`🤖 AI Service: ${USE_LOCAL_MODEL ? 'Ollama (local)' : 'GitHub Models'}`);
