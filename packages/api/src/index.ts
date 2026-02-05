import * as mistral from './services/mistral';
import * as ollama from './services/ollama';
import { isAuthEnabled, verifyToken } from './auth';
import * as Sentry from "@sentry/bun";
import { db, initDb } from './db';

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

// Agent Storage
interface Agent {
  id: string;
  userId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  model?: string;
  service?: string;
  temperature: number;
  maxTokens: number;
  tools: string[];  // Array of tool names, e.g. ["web_search"]
  createdAt: string;
  updatedAt: string;
}

// Database helper functions for agents
const agentsDb = {
  async getAllForUser(userId: string): Promise<Agent[]> {
    const result = await db.execute({
      sql: 'SELECT * FROM agents WHERE user_id = ? ORDER BY updated_at DESC',
      args: [userId],
    });
    return result.rows.map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      systemPrompt: row.system_prompt as string,
      model: row.model as string | undefined,
      service: row.service as string | undefined,
      temperature: row.temperature as number,
      maxTokens: row.max_tokens as number,
      tools: row.tools ? JSON.parse(row.tools as string) : [],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  },

  async getByIdForUser(id: string, userId: string): Promise<Agent | null> {
    const result = await db.execute({
      sql: 'SELECT * FROM agents WHERE id = ? AND user_id = ?',
      args: [id, userId],
    });
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      systemPrompt: row.system_prompt as string,
      model: row.model as string | undefined,
      service: row.service as string | undefined,
      temperature: row.temperature as number,
      maxTokens: row.max_tokens as number,
      tools: row.tools ? JSON.parse(row.tools as string) : [],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  },

  async getById(id: string): Promise<Agent | null> {
    const result = await db.execute({
      sql: 'SELECT * FROM agents WHERE id = ?',
      args: [id],
    });
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      systemPrompt: row.system_prompt as string,
      model: row.model as string | undefined,
      service: row.service as string | undefined,
      temperature: row.temperature as number,
      maxTokens: row.max_tokens as number,
      tools: row.tools ? JSON.parse(row.tools as string) : [],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  },

  async create(agent: Agent): Promise<void> {
    await db.execute({
      sql: 'INSERT INTO agents (id, user_id, name, description, system_prompt, model, service, temperature, max_tokens, tools, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [
        agent.id,
        agent.userId,
        agent.name,
        agent.description || null,
        agent.systemPrompt,
        agent.model || null,
        agent.service || null,
        agent.temperature,
        agent.maxTokens,
        JSON.stringify(agent.tools),
        agent.createdAt,
        agent.updatedAt,
      ],
    });
  },

  async updateForUser(
    id: string,
    userId: string,
    updates: Partial<Omit<Agent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<boolean> {
    const fields: string[] = ['updated_at = ?'];
    const args: (string | number | null)[] = [new Date().toISOString()];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      args.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      args.push(updates.description || null);
    }
    if (updates.systemPrompt !== undefined) {
      fields.push('system_prompt = ?');
      args.push(updates.systemPrompt);
    }
    if (updates.model !== undefined) {
      fields.push('model = ?');
      args.push(updates.model || null);
    }
    if (updates.service !== undefined) {
      fields.push('service = ?');
      args.push(updates.service || null);
    }
    if (updates.temperature !== undefined) {
      fields.push('temperature = ?');
      args.push(updates.temperature);
    }
    if (updates.maxTokens !== undefined) {
      fields.push('max_tokens = ?');
      args.push(updates.maxTokens);
    }
    if (updates.tools !== undefined) {
      fields.push('tools = ?');
      args.push(JSON.stringify(updates.tools));
    }

    args.push(id);
    args.push(userId);
    const result = await db.execute({
      sql: `UPDATE agents SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      args,
    });
    return result.rowsAffected > 0;
  },

  async deleteForUser(id: string, userId: string): Promise<boolean> {
    const result = await db.execute({
      sql: 'DELETE FROM agents WHERE id = ? AND user_id = ?',
      args: [id, userId],
    });
    return result.rowsAffected > 0;
  },
};

// Conversation Storage
interface Conversation {
  id: string;
  userId: string;
  agentId?: string;
  title: string;
  model?: string;
  service?: string;
  createdAt: string;
  updatedAt: string;
}

interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

// Database helper functions for conversations
const conversationsDb = {
  async getAllForUser(userId: string): Promise<Conversation[]> {
    const result = await db.execute({
      sql: 'SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC',
      args: [userId],
    });
    return result.rows.map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      agentId: row.agent_id as string | undefined,
      title: row.title as string,
      model: row.model as string | undefined,
      service: row.service as string | undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  },

  async getByIdForUser(id: string, userId: string): Promise<Conversation | null> {
    const result = await db.execute({
      sql: 'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
      args: [id, userId],
    });
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id as string,
      userId: row.user_id as string,
      agentId: row.agent_id as string | undefined,
      title: row.title as string,
      model: row.model as string | undefined,
      service: row.service as string | undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  },

  async create(conversation: Conversation): Promise<void> {
    await db.execute({
      sql: 'INSERT INTO conversations (id, user_id, agent_id, title, model, service, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [conversation.id, conversation.userId, conversation.agentId || null, conversation.title, conversation.model || null, conversation.service || null, conversation.createdAt, conversation.updatedAt],
    });
  },

  async updateForUser(id: string, userId: string, updates: { title?: string; model?: string; service?: string }): Promise<boolean> {
    const fields: string[] = ['updated_at = ?'];
    const args: (string | null)[] = [new Date().toISOString()];
    
    if (updates.title !== undefined) {
      fields.push('title = ?');
      args.push(updates.title);
    }
    if (updates.model !== undefined) {
      fields.push('model = ?');
      args.push(updates.model);
    }
    if (updates.service !== undefined) {
      fields.push('service = ?');
      args.push(updates.service);
    }
    
    args.push(id);
    args.push(userId);
    const result = await db.execute({
      sql: `UPDATE conversations SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      args,
    });
    return result.rowsAffected > 0;
  },

  async deleteForUser(id: string, userId: string): Promise<boolean> {
    const result = await db.execute({
      sql: 'DELETE FROM conversations WHERE id = ? AND user_id = ?',
      args: [id, userId],
    });
    return result.rowsAffected > 0;
  },

  async getMessagesForUser(conversationId: string, userId: string): Promise<ConversationMessage[] | null> {
    // First verify the conversation belongs to the user
    const conv = await this.getByIdForUser(conversationId, userId);
    if (!conv) return null;
    
    const result = await db.execute({
      sql: 'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      args: [conversationId],
    });
    return result.rows.map((row) => ({
      id: row.id as string,
      conversationId: row.conversation_id as string,
      role: row.role as 'user' | 'assistant',
      content: row.content as string,
      createdAt: row.created_at as string,
    }));
  },

  async addMessageForUser(message: ConversationMessage, userId: string): Promise<boolean> {
    // First verify the conversation belongs to the user
    const conv = await this.getByIdForUser(message.conversationId, userId);
    if (!conv) return false;
    
    await db.execute({
      sql: 'INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [message.id, message.conversationId, message.role, message.content, message.createdAt],
    });
    // Update conversation's updated_at
    await db.execute({
      sql: 'UPDATE conversations SET updated_at = ? WHERE id = ?',
      args: [message.createdAt, message.conversationId],
    });
    return true;
  },
};

// Shopping List Storage
interface ShoppingListItem {
  id: string;
  text: string;
  addedBy: {
    userId: string;
    userName: string;
  };
  createdAt: string;
}

// Database helper functions (async for libSQL)
const shoppingListDb = {
  async getAll(): Promise<ShoppingListItem[]> {
    const result = await db.execute('SELECT * FROM shopping_list ORDER BY created_at DESC');
    return result.rows.map((row) => ({
      id: row.id as string,
      text: row.text as string,
      addedBy: {
        userId: row.user_id as string,
        userName: row.user_name as string,
      },
      createdAt: row.created_at as string,
    }));
  },

  async add(item: ShoppingListItem): Promise<void> {
    await db.execute({
      sql: 'INSERT INTO shopping_list (id, text, user_id, user_name, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [item.id, item.text, item.addedBy.userId, item.addedBy.userName, item.createdAt],
    });
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.execute({
      sql: 'DELETE FROM shopping_list WHERE id = ?',
      args: [id],
    });
    return result.rowsAffected > 0;
  },
};

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

    // GitHub Models status endpoint
    if (url.pathname === '/v1/ghmodels/status' && req.method === 'GET') {
      const isConfigured = mistral.isConfigured();
      if (!isConfigured) {
        return Response.json(
          {
            status: 'offline',
            error: 'GH_MODELS_TOKEN not configured',
            timestamp: new Date().toISOString(),
          },
          { status: 503, headers: corsHeaders }
        );
      }
      return Response.json(
        {
          status: 'online',
          timestamp: new Date().toISOString(),
        },
        { headers: corsHeaders }
      );
    }

    // Ollama status endpoint
    if (url.pathname === '/v1/ollama/status' && req.method === 'GET') {
      try {
        const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        const response = await fetch(`${ollamaUrl}/api/tags`, {
          signal: AbortSignal.timeout(5000), // 5s timeout
        });
        
        if (!response.ok) {
          throw new Error(`Ollama returned ${response.status}`);
        }
        
        const data = await response.json() as { models?: Array<{ name: string }> };
        const modelCount = data.models?.length || 0;
        
        return Response.json(
          {
            status: 'online',
            url: ollamaUrl,
            models: modelCount,
            timestamp: new Date().toISOString(),
          },
          { headers: corsHeaders }
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return Response.json(
          {
            status: 'offline',
            error: errorMessage,
            timestamp: new Date().toISOString(),
          },
          { status: 503, headers: corsHeaders }
        );
      }
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
              description: m.description,
              capabilities: m.capabilities,
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
      // Verify authentication if enabled
      let authenticatedUserId: string | null = null;
      if (isAuthEnabled()) {
        const authHeader = req.headers.get('Authorization');
        const authResult = await verifyToken(authHeader);
        
        if (!authResult) {
          return Response.json(
            { error: 'Unauthorized' },
            { status: 401, headers: corsHeaders }
          );
        }
        authenticatedUserId = authResult.userId;
        console.log(`✅ Authenticated request from user: ${authResult.userId}`);
      }

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
          conversationId?: string;
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
          conversationId,
        } = body;

        if (!message || typeof message !== 'string') {
          return Response.json(
            { error: 'Message is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        // Check if conversation has an agent and load agent config
        let agent: Agent | null = null;
        if (conversationId && authenticatedUserId) {
          const conversation = await conversationsDb.getByIdForUser(conversationId, authenticatedUserId);
          if (conversation?.agentId) {
            agent = await agentsDb.getById(conversation.agentId);
          }
        }

        // Use agent config as defaults, with request params taking precedence
        const effectiveSystemPrompt = systemPrompt || agent?.systemPrompt || 'You are a helpful assistant.';
        const effectiveTemperature = temperature ?? agent?.temperature;
        const effectiveMaxTokens = maxTokens ?? agent?.maxTokens;
        const effectiveModel = model || agent?.model;
        const effectiveService = service || (agent?.service as 'ollama' | 'ghmodels' | undefined);
        const effectiveUseTools = useWebSearch ?? useTools ?? (agent?.tools?.includes('web_search') ?? false);

        // Select service based on request, agent config, or default
        const selectedService =
          effectiveService === 'ghmodels' ? mistral : effectiveService === 'ollama' ? ollama : aiService;

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
          systemPrompt: effectiveSystemPrompt,
          temperature: effectiveTemperature,
          maxTokens: effectiveMaxTokens,
          useTools: effectiveUseTools,
          model: effectiveModel,
        });

        // Persist messages if conversationId is provided and user is authenticated (text only, no images)
        if (conversationId && !imageData && authenticatedUserId) {
          const timestamp = new Date().toISOString();
          // Save user message (verifies conversation ownership)
          const userMsgSaved = await conversationsDb.addMessageForUser({
            id: crypto.randomUUID(),
            conversationId,
            role: 'user',
            content: message,
            createdAt: timestamp,
          }, authenticatedUserId);
          
          if (userMsgSaved) {
            // Save assistant response
            await conversationsDb.addMessageForUser({
              id: crypto.randomUUID(),
              conversationId,
              role: 'assistant',
              content: response.response,
              createdAt: new Date().toISOString(),
            }, authenticatedUserId);
            // Update conversation model/service if changed
            if (model || service) {
              await conversationsDb.updateForUser(conversationId, authenticatedUserId, { model, service });
            }
          }
        }

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

    // Agent endpoints (require authentication)
    // GET /v1/agents - List all agents for authenticated user
    if (url.pathname === '/v1/agents' && req.method === 'GET') {
      const authHeader = req.headers.get('Authorization');
      const authResult = await verifyToken(authHeader);
      if (!authResult) {
        return Response.json(
          { error: 'Unauthorized' },
          { status: 401, headers: corsHeaders }
        );
      }

      try {
        const agents = await agentsDb.getAllForUser(authResult.userId);
        return Response.json({ agents }, { headers: corsHeaders });
      } catch (error) {
        console.error('Agents fetch error:', error);
        Sentry.captureException(error, { extra: { url: req.url, method: req.method, message: 'Agents fetch error' } });
        return Response.json(
          { error: 'Failed to fetch agents' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // POST /v1/agents - Create new agent
    if (url.pathname === '/v1/agents' && req.method === 'POST') {
      const authHeader = req.headers.get('Authorization');
      const authResult = await verifyToken(authHeader);
      if (!authResult) {
        return Response.json(
          { error: 'Unauthorized' },
          { status: 401, headers: corsHeaders }
        );
      }

      try {
        const body = (await req.json()) as {
          name?: string;
          description?: string;
          systemPrompt?: string;
          model?: string;
          service?: string;
          temperature?: number;
          maxTokens?: number;
          tools?: string[];
        };

        if (!body.name || !body.systemPrompt) {
          return Response.json(
            { error: 'Name and system prompt are required' },
            { status: 400, headers: corsHeaders }
          );
        }

        const now = new Date().toISOString();
        const agent: Agent = {
          id: crypto.randomUUID(),
          userId: authResult.userId,
          name: body.name,
          description: body.description,
          systemPrompt: body.systemPrompt,
          model: body.model,
          service: body.service,
          temperature: body.temperature ?? 0.7,
          maxTokens: body.maxTokens ?? 2000,
          tools: body.tools ?? [],
          createdAt: now,
          updatedAt: now,
        };

        await agentsDb.create(agent);
        return Response.json({ agent }, { status: 201, headers: corsHeaders });
      } catch (error) {
        console.error('Agent create error:', error);
        Sentry.captureException(error, { extra: { url: req.url, method: req.method, message: 'Agent create error' } });
        return Response.json(
          { error: 'Failed to create agent' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // GET /v1/agents/:id - Get agent details
    if (url.pathname.match(/^\/v1\/agents\/[^/]+$/) && req.method === 'GET') {
      const authHeader = req.headers.get('Authorization');
      const authResult = await verifyToken(authHeader);
      if (!authResult) {
        return Response.json(
          { error: 'Unauthorized' },
          { status: 401, headers: corsHeaders }
        );
      }

      try {
        const agentId = url.pathname.split('/').pop();
        if (!agentId) {
          return Response.json(
            { error: 'Agent ID is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        const agent = await agentsDb.getByIdForUser(agentId, authResult.userId);
        if (!agent) {
          return Response.json(
            { error: 'Agent not found' },
            { status: 404, headers: corsHeaders }
          );
        }

        return Response.json({ agent }, { headers: corsHeaders });
      } catch (error) {
        console.error('Agent fetch error:', error);
        Sentry.captureException(error, { extra: { url: req.url, method: req.method, message: 'Agent fetch error' } });
        return Response.json(
          { error: 'Failed to fetch agent' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // PATCH /v1/agents/:id - Update agent
    if (url.pathname.match(/^\/v1\/agents\/[^/]+$/) && req.method === 'PATCH') {
      const authHeader = req.headers.get('Authorization');
      const authResult = await verifyToken(authHeader);
      if (!authResult) {
        return Response.json(
          { error: 'Unauthorized' },
          { status: 401, headers: corsHeaders }
        );
      }

      try {
        const agentId = url.pathname.split('/').pop();
        if (!agentId) {
          return Response.json(
            { error: 'Agent ID is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        const body = (await req.json()) as Partial<Omit<Agent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>;

        const updated = await agentsDb.updateForUser(agentId, authResult.userId, body);
        if (!updated) {
          return Response.json(
            { error: 'Agent not found' },
            { status: 404, headers: corsHeaders }
          );
        }

        const agent = await agentsDb.getByIdForUser(agentId, authResult.userId);
        return Response.json({ agent }, { headers: corsHeaders });
      } catch (error) {
        console.error('Agent update error:', error);
        Sentry.captureException(error, { extra: { url: req.url, method: req.method, message: 'Agent update error' } });
        return Response.json(
          { error: 'Failed to update agent' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // DELETE /v1/agents/:id - Delete agent
    if (url.pathname.match(/^\/v1\/agents\/[^/]+$/) && req.method === 'DELETE') {
      const authHeader = req.headers.get('Authorization');
      const authResult = await verifyToken(authHeader);
      if (!authResult) {
        return Response.json(
          { error: 'Unauthorized' },
          { status: 401, headers: corsHeaders }
        );
      }

      try {
        const agentId = url.pathname.split('/').pop();
        if (!agentId) {
          return Response.json(
            { error: 'Agent ID is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        const deleted = await agentsDb.deleteForUser(agentId, authResult.userId);
        if (!deleted) {
          return Response.json(
            { error: 'Agent not found' },
            { status: 404, headers: corsHeaders }
          );
        }

        return Response.json({ success: true, deletedId: agentId }, { headers: corsHeaders });
      } catch (error) {
        console.error('Agent delete error:', error);
        Sentry.captureException(error, { extra: { url: req.url, method: req.method, message: 'Agent delete error' } });
        return Response.json(
          { error: 'Failed to delete agent' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Conversation endpoints (require authentication)
    // GET /v1/conversations - List all conversations for authenticated user
    if (url.pathname === '/v1/conversations' && req.method === 'GET') {
      // Require authentication
      const authHeader = req.headers.get('Authorization');
      const authResult = await verifyToken(authHeader);
      if (!authResult) {
        return Response.json(
          { error: 'Unauthorized' },
          { status: 401, headers: corsHeaders }
        );
      }

      try {
        const conversations = await conversationsDb.getAllForUser(authResult.userId);
        return Response.json({ conversations }, { headers: corsHeaders });
      } catch (error) {
        console.error('Conversations fetch error:', error);
        Sentry.captureException(error, { extra: { url: req.url, method: req.method, message: 'Conversations fetch error' } });
        return Response.json(
          { error: 'Failed to fetch conversations' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // POST /v1/conversations - Create new conversation for authenticated user
    if (url.pathname === '/v1/conversations' && req.method === 'POST') {
      // Require authentication
      const authHeader = req.headers.get('Authorization');
      const authResult = await verifyToken(authHeader);
      if (!authResult) {
        return Response.json(
          { error: 'Unauthorized' },
          { status: 401, headers: corsHeaders }
        );
      }

      try {
        const body = (await req.json()) as {
          title?: string;
          model?: string;
          service?: string;
          agentId?: string;
        };

        // If agentId is provided, verify it belongs to the user
        let agent: Agent | null = null;
        if (body.agentId) {
          agent = await agentsDb.getByIdForUser(body.agentId, authResult.userId);
          if (!agent) {
            return Response.json(
              { error: 'Agent not found' },
              { status: 404, headers: corsHeaders }
            );
          }
        }

        const now = new Date().toISOString();
        const conversation: Conversation = {
          id: crypto.randomUUID(),
          userId: authResult.userId,
          agentId: body.agentId,
          title: body.title || (agent ? `Chat with ${agent.name}` : 'New Conversation'),
          model: body.model || agent?.model,
          service: body.service || agent?.service,
          createdAt: now,
          updatedAt: now,
        };

        await conversationsDb.create(conversation);
        return Response.json({ conversation, agent }, { status: 201, headers: corsHeaders });
      } catch (error) {
        console.error('Conversation create error:', error);
        Sentry.captureException(error, { extra: { url: req.url, method: req.method, message: 'Conversation create error' } });
        return Response.json(
          { error: 'Failed to create conversation' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // GET /v1/conversations/:id - Get conversation with messages (user-scoped)
    if (url.pathname.match(/^\/v1\/conversations\/[^/]+$/) && req.method === 'GET') {
      // Require authentication
      const authHeader = req.headers.get('Authorization');
      const authResult = await verifyToken(authHeader);
      if (!authResult) {
        return Response.json(
          { error: 'Unauthorized' },
          { status: 401, headers: corsHeaders }
        );
      }

      try {
        const conversationId = url.pathname.split('/').pop();
        if (!conversationId) {
          return Response.json(
            { error: 'Conversation ID is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        const conversation = await conversationsDb.getByIdForUser(conversationId, authResult.userId);
        if (!conversation) {
          return Response.json(
            { error: 'Conversation not found' },
            { status: 404, headers: corsHeaders }
          );
        }

        // Load agent info if conversation has an agent
        let agent: Agent | null = null;
        if (conversation.agentId) {
          agent = await agentsDb.getById(conversation.agentId);
        }

        const messages = await conversationsDb.getMessagesForUser(conversationId, authResult.userId);
        return Response.json({ conversation, messages, agent }, { headers: corsHeaders });
      } catch (error) {
        console.error('Conversation fetch error:', error);
        Sentry.captureException(error, { extra: { url: req.url, method: req.method, message: 'Conversation fetch error' } });
        return Response.json(
          { error: 'Failed to fetch conversation' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // PATCH /v1/conversations/:id - Update conversation (user-scoped)
    if (url.pathname.match(/^\/v1\/conversations\/[^/]+$/) && req.method === 'PATCH') {
      // Require authentication
      const authHeader = req.headers.get('Authorization');
      const authResult = await verifyToken(authHeader);
      if (!authResult) {
        return Response.json(
          { error: 'Unauthorized' },
          { status: 401, headers: corsHeaders }
        );
      }

      try {
        const conversationId = url.pathname.split('/').pop();
        if (!conversationId) {
          return Response.json(
            { error: 'Conversation ID is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        const body = (await req.json()) as {
          title?: string;
          model?: string;
          service?: string;
        };

        const updated = await conversationsDb.updateForUser(conversationId, authResult.userId, body);
        if (!updated) {
          return Response.json(
            { error: 'Conversation not found' },
            { status: 404, headers: corsHeaders }
          );
        }

        const conversation = await conversationsDb.getByIdForUser(conversationId, authResult.userId);
        return Response.json({ conversation }, { headers: corsHeaders });
      } catch (error) {
        console.error('Conversation update error:', error);
        Sentry.captureException(error, { extra: { url: req.url, method: req.method, message: 'Conversation update error' } });
        return Response.json(
          { error: 'Failed to update conversation' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // DELETE /v1/conversations/:id - Delete conversation (user-scoped)
    if (url.pathname.match(/^\/v1\/conversations\/[^/]+$/) && req.method === 'DELETE') {
      // Require authentication
      const authHeader = req.headers.get('Authorization');
      const authResult = await verifyToken(authHeader);
      if (!authResult) {
        return Response.json(
          { error: 'Unauthorized' },
          { status: 401, headers: corsHeaders }
        );
      }

      try {
        const conversationId = url.pathname.split('/').pop();
        if (!conversationId) {
          return Response.json(
            { error: 'Conversation ID is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        const deleted = await conversationsDb.deleteForUser(conversationId, authResult.userId);
        if (!deleted) {
          return Response.json(
            { error: 'Conversation not found' },
            { status: 404, headers: corsHeaders }
          );
        }

        return Response.json({ success: true, deletedId: conversationId }, { headers: corsHeaders });
      } catch (error) {
        console.error('Conversation delete error:', error);
        Sentry.captureException(error, { extra: { url: req.url, method: req.method, message: 'Conversation delete error' } });
        return Response.json(
          { error: 'Failed to delete conversation' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Shopping List endpoints
    // GET /v1/shopping-list - Retrieve all items
    if (url.pathname === '/v1/shopping-list' && req.method === 'GET') {
      try {
        const items = await shoppingListDb.getAll();
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

        await shoppingListDb.add(newItem);

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

        const deleted = await shoppingListDb.delete(itemId);

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

// Initialize database and start server
await initDb();

console.log(`🚀 API server running on http://localhost:${server.port}`);
console.log(`📍 Health check: http://localhost:${server.port}/api/v1/status`);
console.log(`🤖 AI Service: ${USE_LOCAL_MODEL ? 'Ollama (local)' : 'GitHub Models'}`);
