# API Server

Backend API server built with Bun.

## Endpoints

### Health Check
- **URL**: `/api/v1/status`
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

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

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
