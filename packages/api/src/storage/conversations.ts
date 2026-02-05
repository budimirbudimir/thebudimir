import { db } from '../db';

export interface Conversation {
  id: string;
  userId: string;
  agentId?: string;
  title: string;
  model?: string;
  service?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

// Database helper functions for conversations
export const conversationsDb = {
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
      args: [
        conversation.id,
        conversation.userId,
        conversation.agentId || null,
        conversation.title,
        conversation.model || null,
        conversation.service || null,
        conversation.createdAt,
        conversation.updatedAt,
      ],
    });
  },

  async updateForUser(
    id: string,
    userId: string,
    updates: { title?: string; model?: string; service?: string },
  ): Promise<boolean> {
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

  async getMessagesForUser(
    conversationId: string,
    userId: string,
  ): Promise<ConversationMessage[] | null> {
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
      args: [
        message.id,
        message.conversationId,
        message.role,
        message.content,
        message.createdAt,
      ],
    });
    // Update conversation's updated_at
    await db.execute({
      sql: 'UPDATE conversations SET updated_at = ? WHERE id = ?',
      args: [message.createdAt, message.conversationId],
    });
    return true;
  },
};
