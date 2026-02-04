#!/bin/bash

# Localtunnel Setup for Ollama
# This script exposes your local Ollama instance to the internet via localtunnel

# Load environment variables from root .env if it exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ -f "$ENV_FILE" ]; then
    echo "📝 Loading environment from $ENV_FILE"
    # Load TUNNEL_SUBDOMAIN from .env file
    set -a
    source <(grep -v '^#' "$ENV_FILE" | grep TUNNEL_SUBDOMAIN)
    set +a
fi

echo "🚇 Starting Localtunnel for Ollama Proxy..."
echo ""
echo "Prerequisites:"
echo "  1. Ollama running on http://localhost:11434"
echo "  2. Ollama Proxy running on https://localhost:8443 (bun run proxy:start)"
echo "  3. localtunnel installed: bun add -g localtunnel"
echo ""

# Check if localtunnel is installed
if ! command -v lt &> /dev/null; then
    echo "❌ localtunnel not found. Installing..."
    bun add -g localtunnel
fi

# Get custom subdomain from env var or command line argument
SUBDOMAIN="${TUNNEL_SUBDOMAIN:-${1:-}}"

if [ -n "$SUBDOMAIN" ]; then
    echo "🔗 Starting tunnel with custom subdomain: $SUBDOMAIN"
    echo "   URL will be: https://$SUBDOMAIN.loca.lt"
    echo "   Tunneling: localhost:11434 (Ollama HTTP)"
    lt --port 11434 --subdomain "$SUBDOMAIN"
else
    echo "🔗 Starting tunnel with random subdomain..."
    echo "   Tip: Set TUNNEL_SUBDOMAIN env var or pass as argument"
    echo "   Example: TUNNEL_SUBDOMAIN=mysubdomain bun run tunnel:start"
    lt --port 11434
fi

echo ""
echo "📝 To use this tunnel:"
echo "   1. Make sure Ollama Proxy is running: bun run proxy:start"
echo "   2. Copy the tunnel URL (e.g., https://thebudimir-llms.loca.lt)"
echo "   3. Set OLLAMA_URL environment variable:"
echo "      Local: Add to packages/api/.env"
echo "      Render: Add in Environment Variables"
echo "   4. Restart/redeploy your API"
echo ""
echo "🔐 Security:"
echo "   - Traffic flows: API -> Tunnel -> Proxy -> Ollama"
echo "   - Proxy provides HTTPS and optional Clerk auth"
echo "   - API provides Clerk authentication"
echo "   - Keep CLERK_SECRET_KEY configured"
