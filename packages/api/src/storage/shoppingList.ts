import { db } from '../db';

export interface ShoppingListItem {
  id: string;
  text: string;
  addedBy: {
    userId: string;
    userName: string;
  };
  createdAt: string;
}

// Database helper functions (async for libSQL)
export const shoppingListDb = {
  async getAll(): Promise<ShoppingListItem[]> {
    const result = await db.execute('SELECT * FROM shopping_list ORDER BY created_at DESC');
    return result.rows.map((row) => ({
      id: row.id as string,
      text: row.text as string,
      addedBy: {
        userId: row.user_id as string,
        userName: row.user_name as string,
      },
      createdAt: row.created_at as string,
    }));
  },

  async add(item: ShoppingListItem): Promise<void> {
    await db.execute({
      sql: 'INSERT INTO shopping_list (id, text, user_id, user_name, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [
        item.id,
        item.text,
        item.addedBy.userId,
        item.addedBy.userName,
        item.createdAt,
      ],
    });
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.execute({
      sql: 'DELETE FROM shopping_list WHERE id = ?',
      args: [id],
    });
    return result.rowsAffected > 0;
  },
};
