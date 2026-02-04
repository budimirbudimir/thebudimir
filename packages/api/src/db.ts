import { createClient, type Client } from '@libsql/client';

// Create database client based on environment
// - Production: Turso Cloud
// - Local: File-based SQLite (or Turso if configured)
function createDbClient(): Client {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    // Use Turso Cloud (production or explicitly configured)
    console.log('💾 Using Turso Cloud database');
    return createClient({
      url: tursoUrl,
      authToken: tursoToken,
    });
  }

  // Local development: use file-based SQLite
  const localPath = process.env.DB_PATH || './data/local.db';
  console.log(`💾 Using local SQLite database: ${localPath}`);
  return createClient({
    url: `file:${localPath}`,
  });
}

export const db = createDbClient();

// Initialize database schema
export async function initDb(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS shopping_list (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}
