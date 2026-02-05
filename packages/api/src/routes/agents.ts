import * as Sentry from '@sentry/bun';
import { verifyToken } from '../auth';
import { agentsDb, type Agent } from '../storage/agents';

export async function handleAgentRoutes(
  req: Request,
  url: URL,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  // GET /v1/agents - List all agents for authenticated user
  if (url.pathname === '/v1/agents' && req.method === 'GET') {
    const authHeader = req.headers.get('Authorization');
    const authResult = await verifyToken(authHeader);
    if (!authResult) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders },
      );
    }

    try {
      const agents = await agentsDb.getAllForUser(authResult.userId);
      return Response.json({ agents }, { headers: corsHeaders });
    } catch (error) {
      console.error('Agents fetch error:', error);
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Agents fetch error' },
      });
      return Response.json(
        { error: 'Failed to fetch agents' },
        { status: 500, headers: corsHeaders },
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
        { status: 401, headers: corsHeaders },
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
        maxIterations?: number;
        tools?: string[];
      };

      if (!body.name || !body.systemPrompt) {
        return Response.json(
          { error: 'Name and system prompt are required' },
          { status: 400, headers: corsHeaders },
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
        maxIterations: body.maxIterations ?? 5,
        tools: body.tools ?? [],
        createdAt: now,
        updatedAt: now,
      };

      await agentsDb.create(agent);
      return Response.json({ agent }, { status: 201, headers: corsHeaders });
    } catch (error) {
      console.error('Agent create error:', error);
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Agent create error' },
      });
      return Response.json(
        { error: 'Failed to create agent' },
        { status: 500, headers: corsHeaders },
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
        { status: 401, headers: corsHeaders },
      );
    }

    try {
      const agentId = url.pathname.split('/').pop();
      if (!agentId) {
        return Response.json(
          { error: 'Agent ID is required' },
          { status: 400, headers: corsHeaders },
        );
      }

      const agent = await agentsDb.getByIdForUser(agentId, authResult.userId);
      if (!agent) {
        return Response.json(
          { error: 'Agent not found' },
          { status: 404, headers: corsHeaders },
        );
      }

      return Response.json({ agent }, { headers: corsHeaders });
    } catch (error) {
      console.error('Agent fetch error:', error);
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Agent fetch error' },
      });
      return Response.json(
        { error: 'Failed to fetch agent' },
        { status: 500, headers: corsHeaders },
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
        { status: 401, headers: corsHeaders },
      );
    }

    try {
      const agentId = url.pathname.split('/').pop();
      if (!agentId) {
        return Response.json(
          { error: 'Agent ID is required' },
          { status: 400, headers: corsHeaders },
        );
      }

      const body = (await req.json()) as Partial<
        Omit<Agent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
      >;

      const updated = await agentsDb.updateForUser(agentId, authResult.userId, body);
      if (!updated) {
        return Response.json(
          { error: 'Agent not found' },
          { status: 404, headers: corsHeaders },
        );
      }

      const agent = await agentsDb.getByIdForUser(agentId, authResult.userId);
      return Response.json({ agent }, { headers: corsHeaders });
    } catch (error) {
      console.error('Agent update error:', error);
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Agent update error' },
      });
      return Response.json(
        { error: 'Failed to update agent' },
        { status: 500, headers: corsHeaders },
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
        { status: 401, headers: corsHeaders },
      );
    }

    try {
      const agentId = url.pathname.split('/').pop();
      if (!agentId) {
        return Response.json(
          { error: 'Agent ID is required' },
          { status: 400, headers: corsHeaders },
        );
      }

      const deleted = await agentsDb.deleteForUser(agentId, authResult.userId);
      if (!deleted) {
        return Response.json(
          { error: 'Agent not found' },
          { status: 404, headers: corsHeaders },
        );
      }

      return Response.json({ success: true, deletedId: agentId }, { headers: corsHeaders });
    } catch (error) {
      console.error('Agent delete error:', error);
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Agent delete error' },
      });
      return Response.json(
        { error: 'Failed to delete agent' },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  return null;
}
