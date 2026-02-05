import { db } from '../db';

export interface Team {
  id: string;
  userId: string;
  name: string;
  description?: string;
  coordinatorAgentId: string;
  memberAgentIds: string[]; // Array of agent IDs
  executionMode: 'sequential' | 'parallel';
  createdAt: string;
  updatedAt: string;
}

// Database helper functions for teams
export const teamsDb = {
  async getAllForUser(userId: string): Promise<Team[]> {
    const result = await db.execute({
      sql: 'SELECT * FROM teams WHERE user_id = ? ORDER BY updated_at DESC',
      args: [userId],
    });
    return result.rows.map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      coordinatorAgentId: row.coordinator_agent_id as string,
      memberAgentIds: row.member_agent_ids ? JSON.parse(row.member_agent_ids as string) : [],
      executionMode: (row.execution_mode as 'sequential' | 'parallel') || 'sequential',
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  },

  async getByIdForUser(id: string, userId: string): Promise<Team | null> {
    const result = await db.execute({
      sql: 'SELECT * FROM teams WHERE id = ? AND user_id = ?',
      args: [id, userId],
    });
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      coordinatorAgentId: row.coordinator_agent_id as string,
      memberAgentIds: row.member_agent_ids ? JSON.parse(row.member_agent_ids as string) : [],
      executionMode: (row.execution_mode as 'sequential' | 'parallel') || 'sequential',
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  },

  async create(team: Team): Promise<void> {
    await db.execute({
      sql: 'INSERT INTO teams (id, user_id, name, description, coordinator_agent_id, member_agent_ids, execution_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [
        team.id,
        team.userId,
        team.name,
        team.description || null,
        team.coordinatorAgentId,
        JSON.stringify(team.memberAgentIds),
        team.executionMode,
        team.createdAt,
        team.updatedAt,
      ],
    });
  },

  async updateForUser(
    id: string,
    userId: string,
    updates: Partial<Omit<Team, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<boolean> {
    const fields: string[] = ['updated_at = ?'];
    const args: (string | null)[] = [new Date().toISOString()];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      args.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      args.push(updates.description || null);
    }
    if (updates.coordinatorAgentId !== undefined) {
      fields.push('coordinator_agent_id = ?');
      args.push(updates.coordinatorAgentId);
    }
    if (updates.memberAgentIds !== undefined) {
      fields.push('member_agent_ids = ?');
      args.push(JSON.stringify(updates.memberAgentIds));
    }
    if (updates.executionMode !== undefined) {
      fields.push('execution_mode = ?');
      args.push(updates.executionMode);
    }

    args.push(id);
    args.push(userId);
    const result = await db.execute({
      sql: `UPDATE teams SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      args,
    });
    return result.rowsAffected > 0;
  },

  async deleteForUser(id: string, userId: string): Promise<boolean> {
    const result = await db.execute({
      sql: 'DELETE FROM teams WHERE id = ? AND user_id = ?',
      args: [id, userId],
    });
    return result.rowsAffected > 0;
  },
};
