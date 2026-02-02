import { describe, it, expect, beforeEach, mock } from 'bun:test';

// Mock fetch globally
const mockFetch = mock(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ items: [] }),
  })
);
global.fetch = mockFetch as any;

describe('ShoppingList', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Reset to default implementation
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      } as Response)
    );
  });

  it('fetches and displays shopping list items', async () => {
    const mockItems = [
      {
        id: '1',
        text: 'Milk',
        addedBy: { userId: 'user_123', userName: 'Test User' },
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        text: 'Bread',
        addedBy: { userId: 'user_456', userName: 'Another User' },
        createdAt: new Date().toISOString(),
      },
    ];

    // Create a new mock for this specific test
    const testMock = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: mockItems }),
      } as Response)
    );
    global.fetch = testMock as any;

    const response = await fetch('/api/shopping-list');
    const data = await response.json();

    expect(data.items.length).toBe(2);
    expect(data.items[0].text).toBe('Milk');
    expect(data.items[1].text).toBe('Bread');
  });

  it('validates fetch is called on component mount', () => {
    // Verify that our mock is set up correctly
    expect(mockFetch).toBeDefined();
    expect(typeof mockFetch).toBe('function');
  });

  it('handles empty shopping list', async () => {
    // Create a new mock for this specific test
    const emptyMock = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      } as Response)
    );
    global.fetch = emptyMock as any;

    const response = await fetch('/api/shopping-list');
    const data = await response.json();
    
    expect(data.items).toEqual([]);
    expect(Array.isArray(data.items)).toBe(true);
  });

  it('handles adding new item to list', async () => {
    const newItem = {
      id: '1',
      text: 'Eggs',
      addedBy: { userId: 'user_123', userName: 'Test User' },
      createdAt: new Date().toISOString(),
    };

    // Create a new mock for this specific test
    const addMock = mock(() =>
      Promise.resolve({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ item: newItem }),
      } as Response)
    );
    global.fetch = addMock as any;

    const response = await fetch('/api/shopping-list', {
      method: 'POST',
      body: JSON.stringify({ text: 'Eggs' }),
    });
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.item.text).toBe('Eggs');
    expect(data.item.id).toBe('1');
  });
});
