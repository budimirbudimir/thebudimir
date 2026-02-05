import { db } from '../db';

export interface Agent {
  id: string;
  userId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  model?: string;
  service?: string;
  temperature: number;
  maxTokens: number;
  maxIterations: number; // Max ReAct loop iterations (default: 5)
  tools: string[]; // Array of tool names, e.g. ["web_search"]
  createdAt: string;
  updatedAt: string;
}

// Database helper functions for agents
export const agentsDb = {
  async getAllForUser(userId: string): Promise<Agent[]> {
    const result = await db.execute({
      sql: 'SELECT * FROM agents WHERE user_id = ? ORDER BY updated_at DESC',
      args: [userId],
    });
    return result.rows.map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      systemPrompt: row.system_prompt as string,
      model: row.model as string | undefined,
      service: row.service as string | undefined,
      temperature: row.temperature as number,
      maxTokens: row.max_tokens as number,
      maxIterations: (row.max_iterations as number) ?? 5,
      tools: row.tools ? JSON.parse(row.tools as string) : [],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  },

  async getByIdForUser(id: string, userId: string): Promise<Agent | null> {
    const result = await db.execute({
      sql: 'SELECT * FROM agents WHERE id = ? AND user_id = ?',
      args: [id, userId],
    });
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      systemPrompt: row.system_prompt as string,
      model: row.model as string | undefined,
      service: row.service as string | undefined,
      temperature: row.temperature as number,
      maxTokens: row.max_tokens as number,
      maxIterations: (row.max_iterations as number) ?? 5,
      tools: row.tools ? JSON.parse(row.tools as string) : [],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  },

  async getById(id: string): Promise<Agent | null> {
    const result = await db.execute({
      sql: 'SELECT * FROM agents WHERE id = ?',
      args: [id],
    });
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      systemPrompt: row.system_prompt as string,
      model: row.model as string | undefined,
      service: row.service as string | undefined,
      temperature: row.temperature as number,
      maxTokens: row.max_tokens as number,
      maxIterations: (row.max_iterations as number) ?? 5,
      tools: row.tools ? JSON.parse(row.tools as string) : [],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  },

  async create(agent: Agent): Promise<void> {
    await db.execute({
      sql: 'INSERT INTO agents (id, user_id, name, description, system_prompt, model, service, temperature, max_tokens, max_iterations, tools, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [
        agent.id,
        agent.userId,
        agent.name,
        agent.description || null,
        agent.systemPrompt,
        agent.model || null,
        agent.service || null,
        agent.temperature,
        agent.maxTokens,
        agent.maxIterations,
        JSON.stringify(agent.tools),
        agent.createdAt,
        agent.updatedAt,
      ],
    });
  },

  async updateForUser(
    id: string,
    userId: string,
    updates: Partial<Omit<Agent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<boolean> {
    const fields: string[] = ['updated_at = ?'];
    const args: (string | number | null)[] = [new Date().toISOString()];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      args.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      args.push(updates.description || null);
    }
    if (updates.systemPrompt !== undefined) {
      fields.push('system_prompt = ?');
      args.push(updates.systemPrompt);
    }
    if (updates.model !== undefined) {
      fields.push('model = ?');
      args.push(updates.model || null);
    }
    if (updates.service !== undefined) {
      fields.push('service = ?');
      args.push(updates.service || null);
    }
    if (updates.temperature !== undefined) {
      fields.push('temperature = ?');
      args.push(updates.temperature);
    }
    if (updates.maxTokens !== undefined) {
      fields.push('max_tokens = ?');
      args.push(updates.maxTokens);
    }
    if (updates.maxIterations !== undefined) {
      fields.push('max_iterations = ?');
      args.push(updates.maxIterations);
    }
    if (updates.tools !== undefined) {
      fields.push('tools = ?');
      args.push(JSON.stringify(updates.tools));
    }

    args.push(id);
    args.push(userId);
    const result = await db.execute({
      sql: `UPDATE agents SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      args,
    });
    return result.rowsAffected > 0;
  },

  async deleteForUser(id: string, userId: string): Promise<boolean> {
    const result = await db.execute({
      sql: 'DELETE FROM agents WHERE id = ? AND user_id = ?',
      args: [id, userId],
    });
    return result.rowsAffected > 0;
  },
};
