import * as mistral from './services/mistral';
import * as ollama from './services/ollama';
import * as Sentry from "@sentry/bun";
import { initDb } from './db';
import { handleStatusRoutes } from './routes/status';
import { handleModelsRoutes } from './routes/models';
import { handleChatRoute } from './routes/chat';
import { handleAgentRoutes } from './routes/agents';
import { handleTeamRoutes } from './routes/teams';
import { handleConversationRoutes } from './routes/conversations';
import { handleShoppingListRoutes } from './routes/shoppingList';

Sentry.init({
  dsn: "https://af687efb7802278d39c8f71712f7757a@o4510818627289088.ingest.de.sentry.io/4510818639741008",
});

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
  // Normalize origins by removing trailing slashes for comparison
  const normalizedOrigin = origin?.replace(/\/$/, '');
  const normalizedAllowed = ALLOWED_ORIGINS.map(o => o?.replace(/\/$/, ''));
  const isAllowed = normalizedOrigin && normalizedAllowed.includes(normalizedOrigin);
  
  if (!isAllowed && origin) {
    console.warn(`CORS: Origin not allowed: ${origin}. Allowed origins:`, ALLOWED_ORIGINS);
  }
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin as string : '',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    // Delegate to route handlers
    const handled =
      (await handleStatusRoutes(req, url, corsHeaders, VERSION)) ||
      (await handleModelsRoutes(req, url, corsHeaders)) ||
      (await handleChatRoute(req, url, corsHeaders, aiService)) ||
      (await handleAgentRoutes(req, url, corsHeaders)) ||
      (await handleTeamRoutes(req, url, corsHeaders, aiService)) ||
      (await handleConversationRoutes(req, url, corsHeaders)) ||
      (await handleShoppingListRoutes(req, url, corsHeaders));

    if (handled) {
      return handled;
    }

    // 404 for all other routes
    Sentry.captureException(
      new Error(`404 Not Found: ${req.method} ${req.url}`),
      { extra: { url: req.url, method: req.method, message: 'Route not found' } },
    );
    return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
  },
});

// Initialize database and start server
await initDb();

console.log(`🚀 API server running on http://localhost:${server.port}`);
console.log(`📍 Health check: http://localhost:${server.port}/api/v1/status`);
console.log(`🤖 AI Service: ${USE_LOCAL_MODEL ? 'Ollama (local)' : 'GitHub Models'}`);
