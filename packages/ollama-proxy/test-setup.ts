// Load .env file before running tests
import { resolve } from 'node:path';

// Load .env from the packages/ollama-proxy directory
const envPath = resolve(import.meta.dir, '.env');

try {
  const envFile = await Bun.file(envPath).text();
  const lines = envFile.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) continue;
    
    const key = trimmed.slice(0, equalIndex).trim();
    const value = trimmed.slice(equalIndex + 1).trim().replace(/^["']|["']$/g, '');
    
    if (key) {
      process.env[key] = value;
    }
  }
  
  console.log('✅ .env file loaded for proxy tests');
  if (process.env.CLERK_SECRET_KEY) {
    console.log(`✅ CLERK_SECRET_KEY is configured for proxy`);
  } else {
    console.log('⚠️  CLERK_SECRET_KEY not found in proxy .env');
  }
} catch (error) {
  console.warn(`⚠️  Failed to load .env file: ${error}`);
  console.warn('   Using system environment variables');
}
