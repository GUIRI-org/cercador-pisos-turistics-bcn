#!/bin/bash
set -e

# This script properly restores the database dump
# Strips out \restrict and \unrestrict commands for compatibility with PostgreSQL < 17.6

echo "Restoring database from ${GLOBAL_DB_NAME}.sql.gz..."

if [ -f /backup/${GLOBAL_DB_NAME}.sql.gz ]; then
    gunzip -c /backup/${GLOBAL_DB_NAME}.sql.gz | \
    grep -v '^\\\restrict' | \
    grep -v '^\\\unrestrict' | \
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"
    echo "Database restore completed successfully."
else
    echo "Warning: ${GLOBAL_DB_NAME}.sql.gz not found, skipping restore."
fi
