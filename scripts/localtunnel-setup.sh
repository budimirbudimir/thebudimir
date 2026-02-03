#!/bin/bash

# Localtunnel Setup for Ollama
# This script exposes your local Ollama instance to the internet via localtunnel

echo "🚇 Starting Localtunnel for Ollama..."
echo ""
echo "Prerequisites:"
echo "  1. Ollama running on http://localhost:11434"
echo "  2. localtunnel installed: bun add -g localtunnel"
echo ""

# Check if localtunnel is installed
if ! command -v lt &> /dev/null; then
    echo "❌ localtunnel not found. Installing..."
    bun add -g localtunnel
fi

# Get custom subdomain if provided
SUBDOMAIN=${1:-""}

if [ -n "$SUBDOMAIN" ]; then
    echo "🔗 Starting tunnel with custom subdomain: $SUBDOMAIN"
    echo "   URL will be: https://$SUBDOMAIN.loca.lt"
    lt --port 11434 --subdomain "$SUBDOMAIN"
else
    echo "🔗 Starting tunnel with random subdomain..."
    echo "   Tip: Use './localtunnel-setup.sh mysubdomain' for a custom URL"
    lt --port 11434
fi

echo ""
echo "📝 To use this tunnel:"
echo "   1. Copy the tunnel URL (e.g., https://xxx.loca.lt)"
echo "   2. Set OLLAMA_URL environment variable on Render:"
echo "      OLLAMA_URL=https://your-tunnel-url.loca.lt"
echo "   3. Redeploy your API on Render"
echo ""
echo "⚠️  Security:"
echo "   - This exposes your Ollama to the internet"
echo "   - Clerk authentication protects it"
echo "   - Keep CLERK_SECRET_KEY configured"
