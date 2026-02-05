import * as mistral from '../services/mistral';
import * as ollama from '../services/ollama';
import { isAuthEnabled, verifyToken } from '../auth';
import { agentsDb, type Agent } from '../storage/agents';
import { conversationsDb } from '../storage/conversations';

export async function handleChatRoute(
  req: Request,
  url: URL,
  corsHeaders: Record<string, string>,
  aiService: { isConfigured(): boolean; chat: (...args: any[]) => Promise<any> },
): Promise<Response | null> {
  if (url.pathname !== '/v1/chat' || req.method !== 'POST') {
    return null;
  }

  // Verify authentication if enabled
  let authenticatedUserId: string | null = null;
  if (isAuthEnabled()) {
    const authHeader = req.headers.get('Authorization');
    const authResult = await verifyToken(authHeader);

    if (!authResult) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders },
      );
    }
    authenticatedUserId = authResult.userId;
    console.log(`✅ Authenticated request from user: ${authResult.userId}`);
  }

  if (!aiService.isConfigured()) {
    return Response.json(
      { error: 'AI service not configured' },
      { status: 503, headers: corsHeaders },
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
        { status: 400, headers: corsHeaders },
      );
    }

    // Check if conversation has an agent and load agent config
    let agent: Agent | null = null;
    if (conversationId && authenticatedUserId) {
      const conversation = await conversationsDb.getByIdForUser(
        conversationId,
        authenticatedUserId,
      );
      if (conversation?.agentId) {
        agent = await agentsDb.getById(conversation.agentId);
      }
    }

    // Use agent config as defaults, with request params taking precedence
    const effectiveSystemPrompt = systemPrompt || agent?.systemPrompt || 'You are a helpful assistant.';
    const effectiveTemperature = temperature ?? agent?.temperature;
    const effectiveMaxTokens = maxTokens ?? agent?.maxTokens;
    const effectiveMaxIterations = agent?.maxIterations ?? 5;
    const effectiveModel = model || agent?.model;
    const effectiveService = service || (agent?.service as 'ollama' | 'ghmodels' | undefined);
    const effectiveUseTools =
      useWebSearch ?? useTools ?? (agent?.tools?.includes('web_search') ?? false);

    // Select service based on request, agent config, or default
    const selectedService =
      effectiveService === 'ghmodels'
        ? mistral
        : effectiveService === 'ollama'
          ? ollama
          : aiService;

    // Check if selected service is configured
    if (!selectedService.isConfigured()) {
      return Response.json(
        { error: 'Selected AI service is not configured' },
        { status: 503, headers: corsHeaders },
      );
    }

    const response = await selectedService.chat({
      message,
      imageData,
      systemPrompt: effectiveSystemPrompt,
      temperature: effectiveTemperature,
      maxTokens: effectiveMaxTokens,
      maxIterations: effectiveMaxIterations,
      useTools: effectiveUseTools,
      model: effectiveModel,
    });

    // Persist messages if conversationId is provided and user is authenticated (text only, no images)
    if (conversationId && !imageData && authenticatedUserId) {
      const timestamp = new Date().toISOString();
      // Save user message (verifies conversation ownership)
      const userMsgSaved = await conversationsDb.addMessageForUser(
        {
          id: crypto.randomUUID(),
          conversationId,
          role: 'user',
          content: message,
          createdAt: timestamp,
        },
        authenticatedUserId,
      );

      if (userMsgSaved) {
        // Save assistant response
        await conversationsDb.addMessageForUser(
          {
            id: crypto.randomUUID(),
            conversationId,
            role: 'assistant',
            content: response.response,
            createdAt: new Date().toISOString(),
          },
          authenticatedUserId,
        );
        // Update conversation model/service if changed
        if (model || service) {
          await conversationsDb.updateForUser(conversationId, authenticatedUserId, {
            model,
            service,
          });
        }
      }
    }

    return Response.json(response, { headers: corsHeaders });
  } catch (error) {
    console.error('Chat error:', error);
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
        response: userMessage,
      },
      { status: 500, headers: corsHeaders },
    );
  }
}
