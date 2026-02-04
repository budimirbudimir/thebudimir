/**
 * HTTPS Proxy for Ollama
 *
 * This proxy allows browsers to access your local Ollama instance from HTTPS sites.
 * It handles CORS, provides HTTPS access, and optionally requires Clerk authentication.
 *
 * Usage:
 *   bun run ollama-proxy.ts
 *
 * Then update your frontend to use https://localhost:8443 instead of http://localhost:11434
 */

import { isAuthEnabled, verifyToken } from './auth';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const PROXY_PORT = process.env.PROXY_PORT ? parseInt(process.env.PROXY_PORT, 10) : 8443;
// Allowed origins for browser CORS. Server-to-server requests (no Origin header) are always allowed.
const ALLOWED_ORIGINS = [
  'https://thebudimir.com',
  'https://api.thebudimir.com',
  'http://localhost:5173', // Vite dev server
  'http://localhost:8080', // Production nginx local
  'http://localhost:3000', // API dev server
];

console.log('🔐 Starting HTTPS Proxy for Ollama...');
console.log(`   Proxying: ${OLLAMA_URL}`);
console.log(`   Port: ${PROXY_PORT}`);
console.log(`   Auth: ${isAuthEnabled() ? 'Enabled ✅' : 'Disabled ⚠️'}`);

const server = Bun.serve({
  port: PROXY_PORT,
  // Allow long-running LLM requests (255s = ~4 minutes, max allowed)
  idleTimeout: 255,
  // Self-signed certificate (you'll need to accept it once in browser)
  tls: {
    cert: Bun.file('./certs/cert.pem'),
    key: Bun.file('./certs/key.pem'),
  },
  async fetch(req) {
    const url = new URL(req.url);
    const origin = req.headers.get('origin');

    // CORS preflight
    if (req.method === 'OPTIONS') {
      const allowOrigin = !origin ? '*' : (ALLOWED_ORIGINS.includes(origin) ? origin : '');
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': allowOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Verify authentication if enabled
    if (isAuthEnabled()) {
      const authHeader = req.headers.get('Authorization');
      const authResult = await verifyToken(authHeader);
      
      if (!authResult) {
        console.warn('⚠️  Unauthorized request blocked');
        const allowOrigin = !origin ? '*' : (ALLOWED_ORIGINS.includes(origin) ? origin : '');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allowOrigin,
          },
        });
      }
      console.log(`✅ Authenticated proxy request from user: ${authResult.userId}`);
    }

    try {
      // Forward request to Ollama
      const ollamaUrl = `${OLLAMA_URL}${url.pathname}${url.search}`;
      console.log(`📡 Proxying: ${req.method} ${ollamaUrl}`);

      const response = await fetch(ollamaUrl, {
        method: req.method,
        headers: {
          'Content-Type': req.headers.get('Content-Type') || 'application/json',
        },
        body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined,
      });

      // Clone response and add CORS headers
      const headers = new Headers(response.headers);
      const allowOrigin = !origin ? '*' : (ALLOWED_ORIGINS.includes(origin) ? origin : '');
      if (allowOrigin) {
        headers.set('Access-Control-Allow-Origin', allowOrigin);
        headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error('❌ Proxy error:', error);
      const allowOrigin = !origin ? '*' : (ALLOWED_ORIGINS.includes(origin) ? origin : '');
      return new Response(
        JSON.stringify({
          error: 'Failed to connect to Ollama',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allowOrigin,
          },
        }
      );
    }
  },
});

console.log(`✅ HTTPS Proxy running on https://localhost:${server.port}`);
console.log(`   Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
console.log('\n⚠️  You may need to accept the self-signed certificate in your browser.');
console.log('📖 To generate certificates, run:');
console.log('   mkdir -p packages/api/certs');
console.log('   cd packages/api/certs');
console.log(
  '   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"'
);
