#!/bin/bash

# Setup script for Ollama HTTPS Proxy
# This creates self-signed certificates for local HTTPS access

echo "🔐 Setting up Ollama HTTPS Proxy..."

# Create certs directory
mkdir -p certs

# Generate self-signed certificate
echo "📜 Generating self-signed certificate..."
openssl req -x509 -newkey rsa:4096 \
  -keyout certs/key.pem \
  -out certs/cert.pem \
  -days 365 \
  -nodes \
  -subj "/CN=localhost" \
  2>/dev/null

if [ $? -eq 0 ]; then
  echo "✅ Certificates generated successfully!"
  echo ""
  echo "📋 Next steps:"
  echo "   1. Run the proxy: bun run ollama-proxy"
  echo "   2. Visit https://localhost:8443 in your browser"
  echo "   3. Accept the self-signed certificate warning"
  echo "   4. Your production site can now access Ollama via HTTPS"
  echo ""
  echo "💡 Tip: Update OLLAMA_URL env var to use https://localhost:8443"
else
  echo "❌ Failed to generate certificates"
  echo "   Make sure openssl is installed: sudo apt install openssl"
  exit 1
fi
