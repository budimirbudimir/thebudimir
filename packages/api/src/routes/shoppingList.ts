import * as Sentry from '@sentry/bun';
import { shoppingListDb, type ShoppingListItem } from '../storage/shoppingList';

export async function handleShoppingListRoutes(
  req: Request,
  url: URL,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  // GET /v1/shopping-list - Retrieve all items
  if (url.pathname === '/v1/shopping-list' && req.method === 'GET') {
    try {
      const items = await shoppingListDb.getAll();
      return Response.json(
        { items },
        { headers: corsHeaders },
      );
    } catch (error) {
      console.error('Shopping list fetch error:', error);
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Shopping list fetch error' },
      });
      return Response.json(
        { error: 'Failed to fetch shopping list' },
        { status: 500, headers: corsHeaders },
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
          { status: 400, headers: corsHeaders },
        );
      }

      if (!userId || !userName) {
        return Response.json(
          { error: 'User information is required (userId, userName)' },
          { status: 400, headers: corsHeaders },
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
        { status: 201, headers: corsHeaders },
      );
    } catch (error) {
      console.error('Shopping list add error:', error);
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Shopping list add error' },
      });
      return Response.json(
        { error: 'Failed to add item' },
        { status: 500, headers: corsHeaders },
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
          { status: 400, headers: corsHeaders },
        );
      }

      const deleted = await shoppingListDb.delete(itemId);

      if (!deleted) {
        return Response.json(
          { error: 'Item not found' },
          { status: 404, headers: corsHeaders },
        );
      }

      return Response.json(
        { success: true, deletedId: itemId },
        { headers: corsHeaders },
      );
    } catch (error) {
      console.error('Shopping list delete error:', error);
      Sentry.captureException(error, {
        extra: { url: req.url, method: req.method, message: 'Shopping list delete error' },
      });
      return Response.json(
        { error: 'Failed to delete item' },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  return null;
}
