# Web Search Integration 🔍

Your API now has agentic web search capabilities powered by Ministral-3B!

## What's New

Your Bun API server (`packages/api`) now supports:

✅ **Function calling** with Ministral-3B  
✅ **Autonomous web search** - the model decides when to search  
✅ **Multi-provider fallback** - Brave API → SearxNG → Mock data  
✅ **Zero config required** - works out of the box with mock data  
✅ **Production-ready** - add Brave API key for real search  

## Quick Start

### 1. Test the Search Service

```bash
bun run packages/api/test-search.ts
```

### 2. Start the API Server

```bash
bun run dev:api
```

### 3. Try It Out

```bash
curl -X POST http://localhost:3000/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the latest developments in AI?",
    "useTools": true
  }'
```

## How It Works

```
User asks a question
       ↓
Ministral-3B analyzes if web search is needed
       ↓
If yes: Calls web_search tool automatically
       ↓
Search providers (Brave/SearxNG/Mock) return results
       ↓
Ministral-3B synthesizes answer from results
       ↓
Response returned with toolsUsed metadata
```

## Files Added

- `packages/api/src/services/search.ts` - Web search service with multi-provider support
- `packages/api/test-search.ts` - Test script for search functionality
- `packages/api/docs/WEB_SEARCH.md` - Complete API documentation
- `packages/api/docs/FRONTEND_EXAMPLE.md` - Frontend integration examples

## Files Modified

- `packages/api/src/services/mistral.ts` - Added function calling support
- `packages/api/src/index.ts` - Added `useTools` parameter to chat endpoint

## Production Setup (Optional)

For production use, get a free Brave Search API key:

1. Sign up at https://brave.com/search/api/
2. Get your API key (2,000 free queries/month)
3. Add to `.env`:

```bash
BRAVE_SEARCH_API_KEY=your_key_here
```

Without the API key, the system uses mock data for development/testing.

## API Changes

### Updated `/v1/chat` Endpoint

**New Parameters:**
- `useTools` (boolean, optional, default: `true`) - Enable function calling

**New Response Fields:**
- `toolsUsed` (string[], optional) - List of tools that were called

### Example Request

```json
{
  "message": "What's the latest news about SpaceX?",
  "systemPrompt": "You are a helpful assistant.",
  "temperature": 0.7,
  "maxTokens": 2000,
  "useTools": true
}
```

### Example Response

```json
{
  "response": "Based on recent search results, SpaceX...",
  "model": "Ministral-3B",
  "toolsUsed": ["web_search(\"latest SpaceX news 2026\")"]
}
```

## Features

### 🤖 Agentic Behavior
The model autonomously decides when to search the web - no manual prompting needed!

### 🔄 Auto Fallback
Three-tier search system:
1. **Brave Search API** (fast, reliable, requires key)
2. **SearxNG** (privacy-focused, free, may be slow)
3. **Mock Data** (development fallback)

### 🛡️ Safe Defaults
- 5-second timeout per search
- Max 5 tool call iterations to prevent loops
- Graceful error handling

### 📊 Observability
- Console logging of search queries
- `toolsUsed` metadata in responses
- Clear error messages

## Testing

```bash
# Test search service
bun run packages/api/test-search.ts

# Run unit tests
bun run test:api

# Type check
bun run type-check

# Lint
bun run lint
```

## Documentation

- **[WEB_SEARCH.md](./docs/WEB_SEARCH.md)** - Full API documentation
- **[FRONTEND_EXAMPLE.md](./docs/FRONTEND_EXAMPLE.md)** - React & vanilla JS examples

## Example Use Cases

Perfect for queries needing current information:

- "What's the weather in Paris?"
- "Latest Bitcoin price"
- "Recent AI news"
- "What happened at CES 2026?"
- "Current stock price of Tesla"

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ POST /v1/chat {useTools: true}
       ↓
┌─────────────────────────────────┐
│  API Server (Bun)               │
│  - Validates request            │
│  - Calls Mistral service        │
└──────┬──────────────────────────┘
       │
       ↓
┌─────────────────────────────────┐
│  Mistral Service                │
│  - Sends to Ministral-3B        │
│  - Handles function calling     │
│  - Executes tool calls          │
└──────┬──────────────────────────┘
       │
       ↓
┌─────────────────────────────────┐
│  Search Service                 │
│  1. Try Brave API               │
│  2. Fallback to SearxNG         │
│  3. Fallback to Mock            │
└──────┬──────────────────────────┘
       │
       ↓
┌─────────────────────────────────┐
│  Web Search Results             │
│  - Formatted for AI             │
│  - Title, URL, content          │
└─────────────────────────────────┘
```

## Troubleshooting

### "No search results found"

This is normal! It means:
- Brave API key not configured → Using SearxNG
- SearxNG instances unreachable → Using mock data
- For production: Add `BRAVE_SEARCH_API_KEY` to your `.env`

### Model not calling search

The model is smart about when to search. It won't search for:
- General knowledge questions
- Questions it can answer from training
- Clarification requests

Force it by being explicit: "Search the web for..."

### TypeScript errors

```bash
bun run type-check
```

Should pass cleanly. If not, check the error messages.

## Next Steps

1. **Test it out** - Try the examples above
2. **Get Brave API key** - For production use (free tier available)
3. **Integrate with frontend** - See FRONTEND_EXAMPLE.md
4. **Add more tools** - Weather, calculator, database queries, etc.

## Contributing

Want to add more tools? Edit `packages/api/src/services/mistral.ts` and add your tool definition following the web_search example.

---

**Built with:**
- Ministral-3B (function calling)
- Brave Search API (optional)
- SearxNG (fallback)
- Bun runtime
- TypeScript
