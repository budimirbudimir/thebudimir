import * as mistral from '../services/mistral';
import * as Sentry from '@sentry/bun';

export async function handleStatusRoutes(
  req: Request,
  url: URL,
  corsHeaders: Record<string, string>,
  VERSION: string,
): Promise<Response | null> {
  // Health check endpoint
  if (url.pathname === '/v1/status') {
    return Response.json(
      {
        status: 'healthy',
        version: VERSION,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      { headers: corsHeaders },
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
        { status: 503, headers: corsHeaders },
      );
    }
    return Response.json(
      {
        status: 'online',
        timestamp: new Date().toISOString(),
      },
      { headers: corsHeaders },
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

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const modelCount = data.models?.length || 0;

      return Response.json(
        {
          status: 'online',
          url: ollamaUrl,
          models: modelCount,
          timestamp: new Date().toISOString(),
        },
        { headers: corsHeaders },
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Sentry.captureException(error);
      return Response.json(
        {
          status: 'offline',
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
        { status: 503, headers: corsHeaders },
      );
    }
  }

  return null;
}
