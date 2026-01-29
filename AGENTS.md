# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a monorepo for personal projects by Budimir Budimir. Contains:
- **main** - Personal website/portfolio (Vite + React + TypeScript)
- **api** - Backend API server (Bun HTTP server with TypeScript)

Additional projects can be added as separate packages under different subdomains.

## Development Commands

> All commands have Makefile shortcuts available. Run `make help` for a full list.

### Setup
```bash
bun install
# or: make install
```

### Development
```bash
bun run dev              # Start all dev servers
bun run dev:main         # Start frontend only
bun run dev:api          # Start API only
# Or use containers: bun run container:dev
```

### Build & Deploy
```bash
bun run build            # Build all packages
bun run build:main       # Build main package only
bun run build:api        # Build API package
bun run type-check       # Run TypeScript compiler
```

### Code Quality
```bash
bun run lint             # Lint with Biome
bun run format           # Format with Biome
bun run check            # Lint and format
```

### Testing
```bash
bun run test             # Run all tests
bun run test:main        # Frontend tests
bun run test:api         # API tests
```

### Containers (Podman preferred locally)
```bash
bun run container:dev    # Start dev container with Podman
bun run container:prod   # Start production container
bun run container:build  # Build production image
```

## Architecture

### Project Structure
- **packages/main/**: Frontend portfolio site
  - **src/pages/**: Page components (Home, Status)
  - **src/App.tsx**: Main app with React Router
  - **src/main.tsx**: Entry point
  - **index.html**: Root HTML template
  - **vite.config.ts**: Vite configuration
  - **tsconfig.json**: TypeScript configuration
- **packages/api/**: Backend API server
  - **src/index.ts**: Bun HTTP server entry point
  - **Dockerfile**: API-specific container build
  - **tsconfig.json**: TypeScript configuration
- **dist/**: Production build output
- **docs/**: GitHub Pages deployment
- **.github/workflows/**: CI/CD pipelines (main-ci, api-ci, release)
- **Dockerfile**: Multi-stage container build for main
- **docker-compose.yml**: Orchestration for main + api services
- **biome.json**: Linting and formatting config
- **.commitlintrc.json**: Commit message validation
- **.releaserc.json**: Semantic release configuration

### Key Configuration
- **TypeScript**: Configured with strict mode, ESNext target
- **Vite**: Uses `@vitejs/plugin-react` and `vite-tsconfig-paths` plugins
- **Build Output**: Compiles to `dist/main/` directory
- **Module System**: ESNext with Node resolution
- **Workspaces**: Bun workspaces configured in root package.json

### Technology Stack
- React 18 with TypeScript
- Bun for package management and runtime
- Vite 5 for build tooling
- Biome for linting and formatting
- Multi-stage Docker/Podman containers (dev: Bun, prod: Nginx)

## Container Preferences
- **Local Development**: Prefer Podman over Docker for container operations
- Docker compatibility should be maintained for CI/CD and other environments
- Use `podman` command locally, but ensure Dockerfiles work with both runtimes

## Notes
- This is a minimal boilerplate project - the actual application is a single-component personal portfolio
- The project mentions Prettier and ESLint in README but no configuration files or lint scripts are present
- Build process runs TypeScript compiler first, then Vite build
- GitHub Pages deployment uses the `docs/` directory (CNAME file present for custom domain)
