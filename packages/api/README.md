# API Server

Backend API server built with Bun.

## Endpoints

### Health Check
- **URL**: `/v1/status`
- **Method**: GET
- **Response**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-29T00:00:00.000Z",
  "uptime": 123.456
}
```

### Chat
- **URL**: `/v1/chat`
- **Method**: POST
- **Request Body**:
```json
{
  "message": "Your question here",
  "imageData": "data:image/png;base64,..." (optional),
  "systemPrompt": "You are a helpful assistant" (optional),
  "useWebSearch": false (optional),
  "temperature": 0.7 (optional),
  "maxTokens": 2000 (optional)
}
```
- **Response**:
```json
{
  "response": "AI response text",
  "model": "mistral-7b-instruct-v0.3",
  "toolsUsed": ["web_search(\"query\")"] (optional)
}
```

**Features:**
- **Text Chat**: Send messages and get AI responses
- **Vision Support**: Attach images as base64 data URLs (PNG, JPEG, WebP)
  - Automatic WebP to PNG conversion for model compatibility
  - Image size validation (max 10MB base64 / ~7.5MB actual)
  - Format detection and validation
- **Web Search**: Enable real-time web search via Brave API or SearxNG
- **Model Selection**: Automatically uses vision models (llava) for images

## Development

```bash
# Start dev server with hot reload
bun run dev

# Or use make
make dev-api

# Or with containers
make container-dev-api
```

Server runs on `http://localhost:3000` by default.

## Environment Variables

### Server Configuration
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `FRONTEND_URL` - Frontend URL for CORS (optional, used in production)

### AI Service Configuration
- `USE_GH_MODELS` - Force GitHub Models even in dev (default: false)
- `GH_MODELS_TOKEN` - GitHub Personal Access Token for GitHub Models API (required for production)

### Local AI (Ollama)
- `OLLAMA_URL` - Ollama server URL (default: http://localhost:11434)
- `OLLAMA_MODEL` - Text model (default: mistral-7b-instruct-v0.3-q4_k_m:custom)
- `OLLAMA_VISION_MODEL` - Vision model for images (default: llava-phi3:latest)

**Image Processing:**
- Supports PNG, JPEG, and WebP formats
- WebP images are automatically converted to PNG using Sharp library
- Maximum image size: 10MB base64 (~7.5MB actual file size)
- LLaVA models have limited WebP support, so conversion ensures compatibility

### Web Search
- `BRAVE_SEARCH_API_KEY` - Brave Search API key for web search (optional, falls back to SearxNG)

## Build

No build step needed - Bun runs TypeScript natively.

```bash
bun run start
```

## Container

```bash
# Build image
podman build -t thebudimir-api --target production .

# Run container
podman run -p 3000:3000 thebudimir-api
```
