#!/bin/bash
# Daily SQLite backup with 30-day retention
set -euo pipefail

DB_PATH="${DATABASE_PATH:-/home/ubuntu/shoulders/data/shoulders.db}"
BACKUP_DIR="/home/ubuntu/shoulders/backups"
DATE=$(date +%Y-%m-%d_%H%M)

mkdir -p "$BACKUP_DIR"

sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/shoulders-$DATE.db'"

# Remove backups older than 30 days
find "$BACKUP_DIR" -name "shoulders-*.db" -mtime +30 -delete

echo "Backup completed: shoulders-$DATE.db"
