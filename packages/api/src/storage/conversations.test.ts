import { beforeEach, describe, expect, mock, test } from 'bun:test';

// --- Mocks ---

const mockDbExecute = mock(
  (_query: { sql: string; args: unknown[] }): Promise<{
    rows: Record<string, unknown>[];
    columns: string[];
    rowsAffected: number;
    lastInsertRowid: bigint;
  }> => Promise.resolve({ rows: [], columns: [], rowsAffected: 0, lastInsertRowid: 0n })
);
mock.module('../db', () => ({
  db: { execute: mockDbExecute },
}));

const mockEncrypt = mock((text: string) => `encrypted:${text}`);
const mockDecrypt = mock((text: string) => text.replace('encrypted:', ''));
const mockIsEncryptionConfigured = mock(() => true);
mock.module('../crypto', () => ({
  encrypt: mockEncrypt,
  decrypt: mockDecrypt,
  isEncryptionConfigured: mockIsEncryptionConfigured,
}));

// Import after mocks are set up
import type { Conversation, ConversationMessage } from './conversations';
import { conversationsDb } from './conversations';

// --- Helpers ---

const NOW = '2025-01-01T00:00:00.000Z';

function makeConversationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conv-1',
    user_id: 'user-a',
    agent_id: null,
    title: 'Test',
    model: null,
    service: null,
    is_private: 0,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeMessageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    role: 'user',
    content: 'hello',
    created_at: NOW,
    ...overrides,
  };
}

// --- Tests ---

describe('conversationsDb – private conversations', () => {
  beforeEach(() => {
    mockDbExecute.mockReset();
    mockEncrypt.mockReset();
    mockDecrypt.mockReset();
    mockIsEncryptionConfigured.mockReset();

    // Restore default implementations after reset
    mockEncrypt.mockImplementation((text: string) => `encrypted:${text}`);
    mockDecrypt.mockImplementation((text: string) => text.replace('encrypted:', ''));
    mockIsEncryptionConfigured.mockReturnValue(true);
  });

  // 1. A new conversation can be created as private
  test('creates a conversation with isPrivate=true', async () => {
    mockDbExecute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      rowsAffected: 1,
      lastInsertRowid: 0n,
    });

    const conversation: Conversation = {
      id: 'conv-private',
      userId: 'user-a',
      title: 'Secret Chat',
      isPrivate: true,
      createdAt: NOW,
      updatedAt: NOW,
    };

    await conversationsDb.create(conversation);

    expect(mockDbExecute).toHaveBeenCalledTimes(1);
    const call = mockDbExecute.mock.calls[0][0] as { sql: string; args: unknown[] };
    expect(call.sql).toContain('INSERT INTO conversations');
    // is_private should be stored as 1
    expect(call.args).toContain(1);
  });

  // 2. Private conversations encrypt messages
  test('encrypts message content when adding to a private conversation', async () => {
    // getByIdForUser returns a private conversation
    mockDbExecute.mockResolvedValueOnce({
      rows: [makeConversationRow({ id: 'conv-1', is_private: 1 })],
      columns: [],
      rowsAffected: 0,
      lastInsertRowid: 0n,
    });
    // INSERT message
    mockDbExecute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      rowsAffected: 1,
      lastInsertRowid: 0n,
    });
    // UPDATE conversation updated_at
    mockDbExecute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      rowsAffected: 1,
      lastInsertRowid: 0n,
    });

    const message: ConversationMessage = {
      id: 'msg-1',
      conversationId: 'conv-1',
      role: 'user',
      content: 'top secret message',
      createdAt: NOW,
    };

    const result = await conversationsDb.addMessageForUser(message, 'user-a');

    expect(result).toBe(true);
    expect(mockEncrypt).toHaveBeenCalledWith('top secret message');

    // The INSERT should use the encrypted content
    const insertCall = mockDbExecute.mock.calls[1][0] as { sql: string; args: unknown[] };
    expect(insertCall.args).toContain('encrypted:top secret message');
  });

  // 3. Private conversations decrypt messages correctly
  test('decrypts message content when reading from a private conversation', async () => {
    // getByIdForUser returns a private conversation
    mockDbExecute.mockResolvedValueOnce({
      rows: [makeConversationRow({ id: 'conv-1', is_private: 1 })],
      columns: [],
      rowsAffected: 0,
      lastInsertRowid: 0n,
    });
    // SELECT messages
    mockDbExecute.mockResolvedValueOnce({
      rows: [
        makeMessageRow({ content: 'encrypted:secret reply' }),
        makeMessageRow({ id: 'msg-2', content: 'encrypted:another secret', role: 'assistant' }),
      ],
      columns: [],
      rowsAffected: 0,
      lastInsertRowid: 0n,
    });

    const messages = await conversationsDb.getMessagesForUser('conv-1', 'user-a');

    expect(messages).not.toBeNull();
    expect(messages!.length).toBe(2);
    expect(mockDecrypt).toHaveBeenCalledTimes(2);
    expect(messages![0].content).toBe('secret reply');
    expect(messages![1].content).toBe('another secret');
  });

  // 4. Non-private conversations do not encrypt messages
  test('does not encrypt message content for non-private conversations', async () => {
    // getByIdForUser returns a non-private conversation
    mockDbExecute.mockResolvedValueOnce({
      rows: [makeConversationRow({ id: 'conv-2', is_private: 0 })],
      columns: [],
      rowsAffected: 0,
      lastInsertRowid: 0n,
    });
    // INSERT message
    mockDbExecute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      rowsAffected: 1,
      lastInsertRowid: 0n,
    });
    // UPDATE conversation updated_at
    mockDbExecute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      rowsAffected: 1,
      lastInsertRowid: 0n,
    });

    const message: ConversationMessage = {
      id: 'msg-3',
      conversationId: 'conv-2',
      role: 'user',
      content: 'plain message',
      createdAt: NOW,
    };

    await conversationsDb.addMessageForUser(message, 'user-a');

    expect(mockEncrypt).not.toHaveBeenCalled();

    // The INSERT should use the original plain content
    const insertCall = mockDbExecute.mock.calls[1][0] as { sql: string; args: unknown[] };
    expect(insertCall.args).toContain('plain message');
  });

  // 5. A user can only access their own private conversations
  test('returns null when a different user tries to access a private conversation', async () => {
    // getByIdForUser scopes by user_id — returns no rows for wrong user
    mockDbExecute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      rowsAffected: 0,
      lastInsertRowid: 0n,
    });

    const result = await conversationsDb.getByIdForUser('conv-1', 'user-b');
    expect(result).toBeNull();
  });

  test('returns null for messages when a different user tries to access a private conversation', async () => {
    // getByIdForUser (called inside getMessagesForUser) returns null for wrong user
    mockDbExecute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      rowsAffected: 0,
      lastInsertRowid: 0n,
    });

    const messages = await conversationsDb.getMessagesForUser('conv-1', 'user-b');
    expect(messages).toBeNull();
  });

  test('does not allow adding messages when user does not own the conversation', async () => {
    // getByIdForUser returns no rows for wrong user
    mockDbExecute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      rowsAffected: 0,
      lastInsertRowid: 0n,
    });

    const message: ConversationMessage = {
      id: 'msg-4',
      conversationId: 'conv-1',
      role: 'user',
      content: 'should not be saved',
      createdAt: NOW,
    };

    const result = await conversationsDb.addMessageForUser(message, 'user-b');

    expect(result).toBe(false);
    // Only the getByIdForUser SELECT should have been called, no INSERT
    expect(mockDbExecute).toHaveBeenCalledTimes(1);
  });
});
