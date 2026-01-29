# Container Usage

This project supports both Docker and Podman. **Podman is preferred for local development.**

Both frontend (main) and backend (api) services can be run in containers.

## Prerequisites

- **Podman** (preferred locally) or Docker
- Podman Compose (for Podman users): `sudo dnf install podman-compose` or `pip install podman-compose`

## Development

### Using Podman (Recommended Locally)

```bash
# Start all services (frontend + API)
podman-compose up main api

# Start individual services
podman-compose up main    # Frontend only
podman-compose up api     # API only

# Or build and run manually
# Frontend
podman build -t thebudimir-main:dev --target development .
podman run -p 5173:5173 -v ./packages/main/src:/app/packages/main/src:z thebudimir-main:dev

# API
cd packages/api
podman build -t thebudimir-api:dev --target development .
podman run -p 3000:3000 -v ./src:/app/src:z thebudimir-api:dev
```

### Using Docker

```bash
# Start all services (frontend + API)
docker compose up main api

# Start individual services
docker compose up main    # Frontend only
docker compose up api     # API only
```

## Production Build

### Using Podman

```bash
# Build and run all production services
podman-compose --profile production up main-prod api-prod

# Or manually
# Frontend
podman build -t thebudimir-main:prod --target production .
podman run -p 8080:80 thebudimir-main:prod

# API
cd packages/api
podman build -t thebudimir-api:prod --target production .
podman run -p 3000:3000 thebudimir-api:prod
```

### Using Docker

```bash
# Build and run production image
docker compose --profile production up main-prod

# Or manually
docker build -t thebudimir-main:prod --target production .
docker run -p 8080:80 thebudimir-main:prod
```

## Notes

### Ports
- Frontend dev: **5173**
- Frontend prod: **8080** (nginx)
- API (dev & prod): **3000**

### Features
- Hot reload enabled in development via volume mounts
- Multi-stage builds for optimized production images
- Compatible with both Docker and Podman
- For Podman on SELinux systems, add `:z` suffix to volume mounts

### Service URLs
- Frontend: `http://localhost:5173` (dev) or `http://localhost:8080` (prod)
- API: `http://localhost:3000`
- API Health Check: `http://localhost:3000/api/v1/status`
