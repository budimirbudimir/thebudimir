import { beforeAll, describe, expect, it } from 'bun:test';

// Test server instance
// let _server: ReturnType<typeof Bun.serve>;
const TEST_PORT = 3333;

// Type definitions
interface ShoppingListItem {
  id: string;
  text: string;
  addedBy: {
    userId: string;
    userName: string;
  };
  completed: boolean;
  createdAt: string;
}

interface ShoppingListResponse {
  items: ShoppingListItem[];
}

interface AddItemResponse {
  item: ShoppingListItem;
}

interface DeleteResponse {
  success: boolean;
  deletedId: string;
}

beforeAll(async () => {
  // Configure test environment before importing
  process.env.PORT = '3333';
  process.env.DB_PATH = ':memory:'; // Use in-memory database for tests
  
  // Import server after setting environment variables
  await import('./index');
  
  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 200));
});

describe('Shopping List API', () => {
  const baseUrl = `http://localhost:${TEST_PORT}/v1/shopping-list`;

  it('GET /v1/shopping-list returns empty list initially', async () => {
    const response = await fetch(baseUrl);
    expect(response.ok).toBe(true);
    const data = await response.json() as ShoppingListResponse;
    expect(data).toHaveProperty('items');
    expect(Array.isArray(data.items)).toBe(true);
  });

  it('POST /v1/shopping-list adds a new item', async () => {
    const newItem = {
      text: 'Test Item',
      userId: 'user_123',
      userName: 'Test User',
    };

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    });

    expect(response.status).toBe(201);
    const data = await response.json() as AddItemResponse;
    expect(data.item).toHaveProperty('id');
    expect(data.item.text).toBe('Test Item');
    expect(data.item.addedBy.userId).toBe('user_123');
    expect(data.item.addedBy.userName).toBe('Test User');
  });

  it('POST /v1/shopping-list validates required fields', async () => {
    // Missing text
    let response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user_123', userName: 'Test User' }),
    });
    expect(response.status).toBe(400);

    // Missing user info
    response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Item' }),
    });
    expect(response.status).toBe(400);
  });

  it('DELETE /v1/shopping-list/:id removes an item', async () => {
    // First, add an item
    const addResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Item to Delete',
        userId: 'user_123',
        userName: 'Test User',
      }),
    });
    const addData = await addResponse.json() as AddItemResponse;
    const itemId = addData.item.id;

    // Then delete it
    const deleteResponse = await fetch(`${baseUrl}/${itemId}`, {
      method: 'DELETE',
    });
    expect(deleteResponse.ok).toBe(true);
    const deleteData = await deleteResponse.json() as DeleteResponse;
    expect(deleteData.success).toBe(true);
    expect(deleteData.deletedId).toBe(itemId);

    // Verify it's gone
    const getResponse = await fetch(baseUrl);
    const getData = await getResponse.json() as ShoppingListResponse;
    const foundItem = getData.items.find((item) => item.id === itemId);
    expect(foundItem).toBeUndefined();
  });

  it('DELETE /v1/shopping-list/:id returns 404 for non-existent item', async () => {
    const response = await fetch(`${baseUrl}/non-existent-id`, {
      method: 'DELETE',
    });
    expect(response.status).toBe(404);
  });

  it('handles CORS properly', async () => {
    const response = await fetch(baseUrl, {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });
});
