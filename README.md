# Personal Projects Monorepo

A Bun-based monorepo for personal projects by Budimir Budimir. Built with Vite + React + TypeScript + Biome, with Docker/Podman containerization.

## Tech Stack

**Frontend:**
- **[Vite](https://vitejs.dev/)** - Lightning-fast build tool
- **[React 18](https://reactjs.org/)** + React Router - UI library with routing
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety

**Backend:**
- **[Bun](https://bun.sh/)** - Fast JavaScript runtime for API server
- **TypeScript** - Type-safe API development

**DevOps:**
- **[Biome](https://biomejs.dev/)** - Fast linter and formatter
- **[Podman](https://podman.io/)/Docker** - Containerization (Podman preferred locally)
- **[GitHub Actions](https://github.com/features/actions)** - CI/CD pipelines
- **[Semantic Release](https://semantic-release.gitbook.io/)** - Automated versioning

## Quick Start

> **Tip:** All commands are available via `make`. Run `make help` to see all options.

### Setup
```bash
bun install
# or
make install
```

### Development
```bash
# Start all services (frontend + API)
bun run dev
# or: make dev

# Start individual services
bun run dev:main    # Frontend only
bun run dev:api     # API only

# Or with containers (Podman)
bun run container:dev
# or: make container-dev
```

### Build
```bash
# Build all packages
bun run build

# Build main package only
bun run build:main
```

### Code Quality
```bash
bun run lint      # Lint code
bun run format    # Format code
bun run check     # Lint and format
```

### Testing
```bash
bun run test         # Run all tests
bun run test:main    # Frontend tests only
bun run test:api     # API tests only
# or
make test
make test-main
make test-api
```

## Project Structure

```
├── packages/
│   ├── main/          # Frontend (React + Vite)
│   └── api/           # Backend API (Bun HTTP server)
├── dist/              # Build output
├── docs/              # GitHub Pages deployment
├── .github/workflows/ # CI/CD pipelines
├── Dockerfile         # Multi-stage container build (main)
├── docker-compose.yml # Container orchestration
├── Makefile           # Convenience commands
├── biome.json         # Code quality config
├── .commitlintrc.json # Commit message linting
└── .releaserc.json    # Semantic release config
```

## Container Usage

See [CONTAINERS.md](./CONTAINERS.md) for detailed container usage with Podman/Docker.

## Commit Conventions

This project uses **[Conventional Commits](https://www.conventionalcommits.org/)** enforced by Commitlint.

### Format
```
type(scope): subject
```

### Types
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `build` - Build system changes
- `ci` - CI/CD changes
- `chore` - Other changes

### Scopes
- `main` - Frontend changes
- `api` - Backend API changes
- `deps` - Dependency updates
- `ci` - CI/CD changes
- `release` - Release-related changes

### Examples
```bash
feat(api): add health check endpoint
fix(main): correct status page styling
docs: update README with API documentation
ci(main): add frontend CI workflow
```

## Release Process

Releases are automated using **Semantic Release**:

1. **Commit changes** following conventional commits format
2. **Merge to main branch** - triggers release workflow
3. **Automatic versioning** - version bumped based on commit types
4. **Changelog generation** - CHANGELOG.md updated automatically
5. **Git tags created** - new version tag pushed
6. **GitHub release** - release notes published

Version bumps:
- `feat:` → Minor version (1.0.0 → 1.1.0)
- `fix:` → Patch version (1.0.0 → 1.0.1)
- `BREAKING CHANGE:` → Major version (1.0.0 → 2.0.0)

## Deployment

Builds are deployed to GitHub Pages from the `docs/` directory.
