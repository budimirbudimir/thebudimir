# syntax=docker/dockerfile:1

# Base stage with Bun
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies stage
FROM base AS deps
COPY package.json bun.lockb ./
COPY packages/main/package.json ./packages/main/
RUN bun install --frozen-lockfile

# Development stage
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/main/node_modules ./packages/main/node_modules
COPY . .
EXPOSE 5173
CMD ["bun", "run", "dev"]

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/main/node_modules ./packages/main/node_modules
COPY . .
RUN bun run build:main

# Production stage with nginx
FROM nginx:alpine AS production
COPY --from=builder /app/dist/main /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
