import { Database } from 'bun:sqlite';
import * as mistral from './services/mistral';
import * as ollama from './services/ollama';import * as Sentry from "@sentry/bun";

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

// Shopping List Storage - SQLite Database
interface ShoppingListItem {
  id: string;
  text: string;
  addedBy: {
    userId: string;
    userName: string;
  };
  createdAt: string;
}

// Initialize SQLite database
const dbPath = process.env.DB_PATH || './data/shopping.db';
const db = new Database(dbPath, { create: true });

// Create shopping_list table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS shopping_list (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

// Database helper functions
const shoppingListDb = {
  getAll(): ShoppingListItem[] {
    const rows = db.query('SELECT * FROM shopping_list ORDER BY created_at DESC').all() as Array<{
      id: string;
      text: string;
      user_id: string;
      user_name: string;
      created_at: string;
    }>;
    return rows.map((row) => ({
      id: row.id,
      text: row.text,
      addedBy: {
        userId: row.user_id,
        userName: row.user_name,
      },
      createdAt: row.created_at,
    }));
  },

  add(item: ShoppingListItem): void {
    db.run(
      'INSERT INTO shopping_list (id, text, user_id, user_name, created_at) VALUES (?, ?, ?, ?, ?)',
      [item.id, item.text, item.addedBy.userId, item.addedBy.userName, item.createdAt]
    );
  },

  delete(id: string): boolean {
    const result = db.run('DELETE FROM shopping_list WHERE id = ?', [id]);
    return result.changes > 0;
  },
};

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
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

    // Models endpoint
    if (url.pathname === '/v1/models' && req.method === 'GET') {
      try {
        // In production, return HTTPS proxy URL for Ollama so browsers can access it
        // Users need to run: bun run ollama-proxy (see OLLAMA-PROXY.md)
        const [ollamaModels, mistralModels] = await Promise.all([
          ollama.listModels(),
          mistral.listModels(),
        ]);

        return Response.json(
          {
            ollama: ollamaModels.map((m) => ({
              id: m.name,
              name: m.name,
              size: m.size,
              modifiedAt: m.modifiedAt,
            })),
            ghmodels: mistralModels.map((m) => ({
              id: m.id,
              name: m.name,
              description: m.description,
              capabilities: m.capabilities,
            })),
          },
          { headers: corsHeaders }
        );
      } catch (error) {
        console.error('Models fetch error:', error);
        return Response.json(
          { error: 'Failed to fetch available models' },
          { status: 500, headers: corsHeaders }
        );
      }
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
          imageData?: string;
          systemPrompt?: string;
          temperature?: number;
          maxTokens?: number;
          useTools?: boolean;
          useWebSearch?: boolean;
          model?: string;
          service?: 'ollama' | 'ghmodels';
        };
        const {
          message,
          imageData,
          systemPrompt,
          temperature,
          maxTokens,
          useTools,
          useWebSearch,
          model,
          service,
        } = body;

        if (!message || typeof message !== 'string') {
          return Response.json(
            { error: 'Message is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        // Select service based on request or default
        const selectedService =
          service === 'ghmodels' ? mistral : service === 'ollama' ? ollama : aiService;

        // Check if selected service is configured
        if (!selectedService.isConfigured()) {
          return Response.json(
            { error: 'Selected AI service is not configured' },
            { status: 503, headers: corsHeaders }
          );
        }

        const response = await selectedService.chat({
          message,
          imageData,
          systemPrompt,
          temperature,
          maxTokens,
          useTools: useWebSearch ?? useTools,
          model,
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
            response: userMessage, // Also include as response for consistent handling
          },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Shopping List endpoints
    // GET /v1/shopping-list - Retrieve all items
    if (url.pathname === '/v1/shopping-list' && req.method === 'GET') {
      try {
        const items = shoppingListDb.getAll();
        return Response.json(
          { items },
          { headers: corsHeaders }
        );
      } catch (error) {
        console.error('Shopping list fetch error:', error);
        Sentry.captureException(error, { extra: { url: req.url, method: req.method, message: 'Shopping list fetch error' } });
        return Response.json(
          { error: 'Failed to fetch shopping list' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // POST /v1/shopping-list - Add a new item
    if (url.pathname === '/v1/shopping-list' && req.method === 'POST') {
      try {
        const body = (await req.json()) as {
          text?: string;
          userId?: string;
          userName?: string;
        };

        const { text, userId, userName } = body;

        if (!text || typeof text !== 'string' || text.trim() === '') {
          return Response.json(
            { error: 'Item text is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        if (!userId || !userName) {
          return Response.json(
            { error: 'User information is required (userId, userName)' },
            { status: 400, headers: corsHeaders }
          );
        }

        const newItem: ShoppingListItem = {
          id: crypto.randomUUID(),
          text: text.trim(),
          addedBy: {
            userId,
            userName,
          },
          createdAt: new Date().toISOString(),
        };

        shoppingListDb.add(newItem);

        return Response.json(
          { item: newItem },
          { status: 201, headers: corsHeaders }
        );
      } catch (error) {
        console.error('Shopping list add error:', error);
        Sentry.captureException(error, { extra: { url: req.url, method: req.method, message: 'Shopping list add error' } });
        return Response.json(
          { error: 'Failed to add item' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // DELETE /v1/shopping-list/:id - Delete an item
    if (url.pathname.startsWith('/v1/shopping-list/') && req.method === 'DELETE') {
      try {
        const itemId = url.pathname.split('/').pop();
        
        if (!itemId) {
          return Response.json(
            { error: 'Item ID is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        const deleted = shoppingListDb.delete(itemId);

        if (!deleted) {
          return Response.json(
            { error: 'Item not found' },
            { status: 404, headers: corsHeaders }
          );
        }

        return Response.json(
          { success: true, deletedId: itemId },
          { headers: corsHeaders }
        );
      } catch (error) {
        console.error('Shopping list delete error:', error);
        Sentry.captureException(error, { extra: { url: req.url, method: req.method, message: 'Shopping list delete error' } });
        return Response.json(
          { error: 'Failed to delete item' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // 404 for all other routes
    Sentry.captureException(new Error(`404 Not Found: ${req.method} ${req.url}`), { extra: { url: req.url, method: req.method, message: 'Route not found' } });
    return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
  },
});

console.log(`🚀 API server running on http://localhost:${server.port}`);
console.log(`📍 Health check: http://localhost:${server.port}/api/v1/status`);
console.log(`🤖 AI Service: ${USE_LOCAL_MODEL ? 'Ollama (local)' : 'GitHub Models'}`);
console.log(`💾 Database: ${dbPath}`);
