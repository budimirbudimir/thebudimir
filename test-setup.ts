// Load .env files from all packages before running tests
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const packages = ['packages/api', 'packages/ollama-proxy'];

for (const pkg of packages) {
  const envPath = resolve(import.meta.dir, pkg, '.env');
  
  if (!existsSync(envPath)) {
    continue;
  }
  
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
      
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
    
    console.log(`✅ Loaded .env from ${pkg}`);
  } catch (error) {
    console.warn(`⚠️  Failed to load .env from ${pkg}: ${error}`);
  }
}

if (process.env.CLERK_SECRET_KEY) {
  console.log(`✅ CLERK_SECRET_KEY is configured globally`);
}
if (process.env.GH_MODELS_TOKEN) {
  console.log(`✅ GH_MODELS_TOKEN is configured globally`);
}
