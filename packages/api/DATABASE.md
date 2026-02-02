# Database Configuration

The API uses SQLite for data persistence, specifically for the shopping list feature.

## Overview

- **Database Engine**: SQLite (built into Bun)
- **Default Location**: `./data/shopping.db`
- **Schema**: Single table `shopping_list` with columns for id, text, user info, and timestamps

## Database Schema

```sql
CREATE TABLE shopping_list (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

## Configuration

The database path can be configured via the `DB_PATH` environment variable:

```bash
# Local development (default)
DB_PATH=./data/shopping.db

# Production (in container)
DB_PATH=/app/data/shopping.db

# Custom location
DB_PATH=/path/to/your/database.db
```

## Development

The database file is created automatically when the server starts. The `data/` directory is:
- Created automatically if it doesn't exist
- Excluded from git (see `.gitignore`)
- Mounted as a volume in Docker/Podman containers

### Local Development

```bash
# Start the API server
cd packages/api
bun run src/index.ts

# Database will be created at: packages/api/data/shopping.db
```

### Container Development

```bash
# Start with docker-compose (data persists in bind mount)
bun run container:dev

# Database location: packages/api/data/shopping.db (host)
# Mapped to: /app/data/shopping.db (container)
```

## Production

In production, use a named volume for data persistence:

```bash
# Using docker-compose
docker-compose --profile production up -d

# Data persists in named volume: api-data
```

### Volume Management

```bash
# List volumes
docker volume ls

# Inspect the data volume
docker volume inspect thebudimir_api-data

# Backup the database
docker run --rm -v thebudimir_api-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/shopping-db-backup.tar.gz -C /data .

# Restore from backup
docker run --rm -v thebudimir_api-data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/shopping-db-backup.tar.gz -C /data
```

## Migration from In-Memory Storage

If you were previously using the in-memory implementation, all data was lost on server restart. With SQLite:
- Data persists across restarts
- Backup and restore is possible
- Can be inspected/modified with SQLite tools

## Inspecting the Database

You can inspect the database using Bun's built-in SQLite REPL or any SQLite tool:

```bash
# Using Bun
bun repl
> const { Database } = require('bun:sqlite')
> const db = new Database('./packages/api/data/shopping.db')
> db.query('SELECT * FROM shopping_list').all()

# Using sqlite3 CLI (if installed)
sqlite3 packages/api/data/shopping.db
sqlite> .schema
sqlite> SELECT * FROM shopping_list;
sqlite> .quit
```

## Troubleshooting

### Database locked error
If you see "database is locked" errors:
- Ensure only one server instance is running
- Check for orphaned processes: `lsof | grep shopping.db`

### Permission errors
In containers with user mapping (PUID/PGID):
- Ensure the data directory has correct permissions
- Check the volume mount has `:z` flag for SELinux contexts

### Data not persisting
- Verify the volume is properly mounted (check docker-compose.yml)
- Check logs: `docker logs thebudimir-api`
- Ensure DB_PATH environment variable is set correctly
