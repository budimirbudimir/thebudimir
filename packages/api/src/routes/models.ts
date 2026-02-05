import * as mistral from '../services/mistral';
import * as ollama from '../services/ollama';

export async function handleModelsRoutes(
  req: Request,
  url: URL,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (url.pathname === '/v1/models' && req.method === 'GET') {
    try {
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
        { headers: corsHeaders },
      );
    } catch (error) {
      console.error('Models fetch error:', error);
      return Response.json(
        { error: 'Failed to fetch available models' },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  return null;
}
