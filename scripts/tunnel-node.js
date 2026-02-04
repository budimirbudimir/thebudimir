#!/usr/bin/env node

/**
 * LocalTunnel with HTTPS proxy support
 * Uses localtunnel Node.js API to tunnel HTTPS proxy with self-signed certs
 */

const localtunnel = require('localtunnel');

// Load subdomain from environment or use default
const subdomain = process.env.TUNNEL_SUBDOMAIN || '';
const port = 8443; // HTTPS proxy port

console.log('🚇 Starting Localtunnel for Ollama Proxy...');
console.log('');
console.log('Prerequisites:');
console.log('  1. Ollama running on http://localhost:11434');
console.log('  2. Ollama Proxy running on https://localhost:8443 (bun run proxy:start)');
console.log('');

const options = {
  port: port,
  local_https: true,
  allow_invalid_cert: true,
};

if (subdomain) {
  options.subdomain = subdomain;
  console.log(`🔗 Requesting custom subdomain: ${subdomain}`);
} else {
  console.log('🔗 Requesting random subdomain...');
  console.log('   Tip: Set TUNNEL_SUBDOMAIN env var for custom URL');
}

(async () => {
  try {
    const tunnel = await localtunnel(options);

    console.log('');
    console.log('✅ Tunnel established!');
    console.log(`   URL: ${tunnel.url}`);
    console.log(`   Tunneling: localhost:${port} (HTTPS Proxy)`);
    console.log('');
    console.log('📝 To use this tunnel:');
    console.log('   1. Copy the tunnel URL');
    console.log('   2. Set OLLAMA_URL environment variable:');
    console.log('      Local: Add to packages/api/.env');
    console.log('      Render: Add in Environment Variables');
    console.log('   3. Restart/redeploy your API');
    console.log('');
    console.log('🔐 Security:');
    console.log('   - Traffic flows: API -> Tunnel -> Proxy (HTTPS) -> Ollama');
    console.log('   - Proxy handles authentication (optional)');
    console.log('   - API provides Clerk authentication');
    console.log('');
    console.log('Press Ctrl+C to stop the tunnel...');

    tunnel.on('close', () => {
      console.log('\n👋 Tunnel closed');
      process.exit(0);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down tunnel...');
      tunnel.close();
    });

  } catch (err) {
    console.error('❌ Failed to create tunnel:', err.message);
    process.exit(1);
  }
})();
