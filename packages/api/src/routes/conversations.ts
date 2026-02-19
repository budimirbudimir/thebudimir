import * as Sentry from '@sentry/bun';
import { isAuthEnabled, verifyToken } from '../auth';
import {
  conversationsDb,
  type Conversation,
} from '../storage/conversations';
import { agentsDb, type Agent } from '../storage/agents';

// Helper function to get user ID based on auth status
// Returns the userId if auth is disabled or if token is valid
// Returns null if auth is enabled but token is invalid (caller should return 401)
async function getUserId(req: Request): Promise<{ userId: string | null; isAuthRequired: boolean }> {
  const authEnabled = isAuthEnabled();
  
  if (!authEnabled) {
    // When auth is disabled, use a default user ID
    return { userId: 'default-user', isAuthRequired: false };
  }
  
  const authHeader = req.headers.get('Authorization');
  const authResult = await verifyToken(authHeader);
  
  if (!authResult) {
    // Auth is enabled but no valid token
    return { userId: null, isAuthRequired: true };
  }
  
  return { userId: authResult.userId, isAuthRequired: true };
}

export async function handleConversationRoutes(
  req: Request,
  url: URL,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  // GET /v1/conversations - List all conversations for authenticated user
  if (url.pathname === '/v1/conversations' && req.method === 'GET') {
    const { userId, isAuthRequired } = await getUserId(req);
    
    // If auth is required but no valid token, return 401
    if (isAuthRequired && !userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders },
      );
    }

    try {
      const conversations = await conversationsDb.getAllForUser(userId!);
      return Response.json({ conversations }, { headers: corsHeaders });
    } catch (error) {
      console.error('Conversations fetch error:', error);
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Conversations fetch error' },
      });
      return Response.json(
        { error: 'Failed to fetch conversations' },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  // POST /v1/conversations - Create new conversation for authenticated user
  if (url.pathname === '/v1/conversations' && req.method === 'POST') {
    const { userId, isAuthRequired } = await getUserId(req);
    
    // If auth is required but no valid token, return 401
    if (isAuthRequired && !userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders },
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
        agent = await agentsDb.getByIdForUser(body.agentId, userId!);
        if (!agent) {
          return Response.json(
            { error: 'Agent not found' },
            { status: 404, headers: corsHeaders },
          );
        }
      }

      const now = new Date().toISOString();
      const conversation: Conversation = {
        id: crypto.randomUUID(),
        userId: userId!,
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
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Conversation create error' },
      });
      return Response.json(
        { error: 'Failed to create conversation' },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  // GET /v1/conversations/:id - Get conversation with messages (user-scoped)
  if (url.pathname.match(/^\/v1\/conversations\/[^/]+$/) && req.method === 'GET') {
    const { userId, isAuthRequired } = await getUserId(req);
    
    // If auth is required but no valid token, return 401
    if (isAuthRequired && !userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders },
      );
    }

    try {
      const conversationId = url.pathname.split('/').pop();
      if (!conversationId) {
        return Response.json(
          { error: 'Conversation ID is required' },
          { status: 400, headers: corsHeaders },
        );
      }

      const conversation = await conversationsDb.getByIdForUser(
        conversationId,
        userId!,
      );
      if (!conversation) {
        return Response.json(
          { error: 'Conversation not found' },
          { status: 404, headers: corsHeaders },
        );
      }

      // Load agent info if conversation has an agent
      let agent: Agent | null = null;
      if (conversation.agentId) {
        agent = await agentsDb.getById(conversation.agentId);
      }

      const messages = await conversationsDb.getMessagesForUser(
        conversationId,
        userId!,
      );
      return Response.json({ conversation, messages, agent }, { headers: corsHeaders });
    } catch (error) {
      console.error('Conversation fetch error:', error);
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Conversation fetch error' },
      });
      return Response.json(
        { error: 'Failed to fetch conversation' },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  // PATCH /v1/conversations/:id - Update conversation (user-scoped)
  if (url.pathname.match(/^\/v1\/conversations\/[^/]+$/) && req.method === 'PATCH') {
    const { userId, isAuthRequired } = await getUserId(req);
    
    // If auth is required but no valid token, return 401
    if (isAuthRequired && !userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders },
      );
    }

    try {
      const conversationId = url.pathname.split('/').pop();
      if (!conversationId) {
        return Response.json(
          { error: 'Conversation ID is required' },
          { status: 400, headers: corsHeaders },
        );
      }

      const body = (await req.json()) as {
        title?: string;
        model?: string;
        service?: string;
      };

      const updated = await conversationsDb.updateForUser(
        conversationId,
        userId!,
        body,
      );
      if (!updated) {
        return Response.json(
          { error: 'Conversation not found' },
          { status: 404, headers: corsHeaders },
        );
      }

      const conversation = await conversationsDb.getByIdForUser(
        conversationId,
        userId!,
      );
      return Response.json({ conversation }, { headers: corsHeaders });
    } catch (error) {
      console.error('Conversation update error:', error);
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Conversation update error' },
      });
      return Response.json(
        { error: 'Failed to update conversation' },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  // DELETE /v1/conversations/:id - Delete conversation (user-scoped)
  if (url.pathname.match(/^\/v1\/conversations\/[^/]+$/) && req.method === 'DELETE') {
    const { userId, isAuthRequired } = await getUserId(req);
    
    // If auth is required but no valid token, return 401
    if (isAuthRequired && !userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders },
      );
    }

    try {
      const conversationId = url.pathname.split('/').pop();
      if (!conversationId) {
        return Response.json(
          { error: 'Conversation ID is required' },
          { status: 400, headers: corsHeaders },
        );
      }

      const deleted = await conversationsDb.deleteForUser(
        conversationId,
        userId!,
      );
      if (!deleted) {
        return Response.json(
          { error: 'Conversation not found' },
          { status: 404, headers: corsHeaders },
        );
      }

      return Response.json(
        { success: true, deletedId: conversationId },
        { headers: corsHeaders },
      );
    } catch (error) {
      console.error('Conversation delete error:', error);
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Conversation delete error' },
      });
      return Response.json(
        { error: 'Failed to delete conversation' },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  return null;
}
