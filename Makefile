.PHONY: help install dev dev-main dev-api dev-full dev-tunnel build build-main build-api type-check test test-main test-api lint format check clean container-dev container-dev-main container-dev-api container-prod container-build ollama-start ollama-stop ollama-restart proxy-start proxy-setup tunnel-start

# Default target
help:
	@echo "Available commands:"
	@echo "  make install          - Install dependencies with Bun"
	@echo "  make dev             - Start all dev servers (main + api)"
	@echo "  make dev-full        - Start main + api + ollama proxy"
	@echo "  make dev-tunnel      - Start main + api + ollama proxy + localtunnel"
	@echo "  make dev-main        - Start main (frontend) dev server"
	@echo "  make dev-api         - Start API dev server"
	@echo "  make proxy-setup     - Generate SSL certs for Ollama proxy"
	@echo "  make proxy-start     - Start Ollama HTTPS proxy"
	@echo "  make tunnel-start    - Start localtunnel to expose Ollama"
	@echo "  make build           - Build all packages"
	@echo "  make build-main      - Build main package only"
	@echo "  make build-api       - Build API package"
	@echo "  make type-check      - Run TypeScript type checking"
	@echo "  make test            - Run all tests"
	@echo "  make test-main       - Run main package tests"
	@echo "  make test-api        - Run API package tests"
	@echo "  make lint            - Lint code with Biome"
	@echo "  make format          - Format code with Biome"
	@echo "  make check           - Lint and format code with Biome"
	@echo "  make clean           - Remove build artifacts"
	@echo "  make container-dev      - Start all dev containers with Podman"
	@echo "  make container-dev-main - Start main dev container"
	@echo "  make container-dev-api  - Start API dev container"
	@echo "  make container-prod     - Start prod containers with Podman"
	@echo "  make container-build    - Build production container images"
	@echo "  make ollama-start       - Start Ollama with optimized settings"
	@echo "  make ollama-stop        - Stop Ollama server"
	@echo "  make ollama-restart     - Restart Ollama with new settings"

# Dependencies
install:
	bun install

# Development
dev:
	bun run dev

dev-full:
	@echo "🚀 Starting main + api + ollama proxy..."
	@bunx concurrently -n main,api,proxy -c cyan,magenta,yellow \
		"bun run dev:main" \
		"bun run dev:api" \
		"bun run proxy:start"

dev-tunnel:
	@echo "🚀 Starting main + api + ollama proxy + localtunnel..."
	@bunx concurrently -n main,api,proxy,tunnel -c cyan,magenta,yellow,green \
		"bun run dev:main" \
		"bun run dev:api" \
		"bun run proxy:start" \
		"bun run tunnel:start"

dev-main:
	bun run dev:main

dev-api:
	bun run dev:api

# Proxy & Tunnel
proxy-setup:
	bun run proxy:setup

proxy-start:
	bun run proxy:start

tunnel-start:
	bun run tunnel:start

# Build
build:
	bun run build

build-main:
	bun run build:main

build-api:
	bun run build:api

type-check:
	bun run type-check

# Tests
test:
	bun run test

test-main:
	bun run test:main

test-api:
	bun run test:api

# Code Quality
lint:
	bun run lint

format:
	bun run format

check:
	bun run check

# Cleanup
clean:
	rm -rf dist/ node_modules/ packages/*/node_modules/ .biome-cache/

# Containers (Podman)
container-dev:
	podman-compose up main api

container-dev-main:
	podman-compose up main

container-dev-api:
	podman-compose up api

container-prod:
	podman-compose --profile production up main-prod

container-build:
	podman build -t thebudimir-main:latest --target production .

# Docker alternatives (if needed)
docker-dev:
	docker compose up main

docker-prod:
	docker compose --profile production up main-prod

docker-build:
	docker build -t thebudimir-main:latest --target production .

# Ollama Management
ollama-start:
	@echo "Starting Ollama with optimized settings..."
	@./scripts/start-ollama.sh

ollama-stop:
	@echo "Stopping Ollama..."
	@pkill -f "ollama serve" || echo "Ollama not running"

ollama-restart: ollama-stop
	@echo "Waiting for Ollama to stop..."
	@sleep 2
	@$(MAKE) ollama-start
