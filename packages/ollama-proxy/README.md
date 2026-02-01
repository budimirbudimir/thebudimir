# Ollama HTTPS Proxy

This proxy allows you to use your local Ollama instance from the production website (`https://thebudimir.com`).

## Why is this needed?

Browsers block HTTP requests from HTTPS sites (mixed content policy). Since your production site uses HTTPS and Ollama runs on HTTP, you need an HTTPS proxy in between.

## Setup (One-time)

1. **Generate SSL certificates:**
   ```bash
   cd packages/api
   ./setup-ollama-proxy.sh
   ```

   This creates self-signed certificates in `packages/api/certs/`

2. **Start the proxy:**
   ```bash
   cd packages/api
   bun run ollama-proxy
   ```

   The proxy will run on `https://localhost:8443`

3. **Accept the certificate:**
   - Open `https://localhost:8443` in your browser
   - Accept the self-signed certificate warning (click "Advanced" → "Proceed")
   - You only need to do this once per browser

4. **Use from production:**
   - Visit `https://thebudimir.com/chat`
   - Upload an image
   - Your local Ollama models will be available!

## How it works

```
Production Site (HTTPS)
    ↓
https://localhost:8443 (HTTPS Proxy with CORS)
    ↓
http://localhost:11434 (Ollama)
```

The proxy:
- ✅ Provides HTTPS access to Ollama
- ✅ Handles CORS for browser requests
- ✅ Forwards all requests to your local Ollama

## Troubleshooting

### "Certificate not trusted" warning
This is normal for self-signed certificates. Just accept it once in your browser.

### "Failed to connect to Ollama"
- Make sure Ollama is running: `ollama serve`
- Make sure the proxy is running: `bun run ollama-proxy`
- Check Ollama is on port 11434: `curl http://localhost:11434/api/tags`

### Models not showing up
- Restart the proxy after pulling new models
- Refresh the browser page

## Alternative: Direct Ollama CORS

Instead of the proxy, you can configure Ollama directly (less secure):

```bash
# Set allowed origins
export OLLAMA_ORIGINS="https://thebudimir.com"
ollama serve
```

**Note:** This still won't work from HTTPS sites due to mixed content blocking.

## Configuration

Environment variables for the proxy:

- `OLLAMA_URL`: Ollama endpoint (default: `http://localhost:11434`)
- `PROXY_PORT`: Proxy port (default: `8443`)

Example:
```bash
OLLAMA_URL=http://localhost:11434 PROXY_PORT=9443 bun run ollama-proxy
```
