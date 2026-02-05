import { createClient, type Client } from '@libsql/client';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

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
  
  // Ensure the directory exists
  const dir = dirname(localPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      system_prompt TEXT NOT NULL,
      model TEXT,
      service TEXT,
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 2000,
      tools TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Create index for faster agent lookups by user
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id)
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      agent_id TEXT,
      title TEXT NOT NULL,
      model TEXT,
      service TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
    )
  `);

  // Create index for faster conversation lookups by user
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `);

  // Create index for faster message lookups by conversation
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)
  `);
}
