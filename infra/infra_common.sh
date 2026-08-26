#!/bin/bash

COMPOSE_BINARY="docker compose"
# Services on working environments.
BASE_COMPOSE_FILES="-f compose-db.yaml -f compose-mage.yaml -f compose-nginx.yaml -f compose-api.yaml"
# Services on developmentg environments, only.
FRONTEND_COMPOSE_FILES="-f compose-next-app.yaml"
# Use base files by default, add frontend files only when requested
COMPOSE_FILES="$BASE_COMPOSE_FILES"
if [ "${RUN_FRONTEND:-}" = "true" ]; then
    COMPOSE_FILES="$COMPOSE_FILES $FRONTEND_COMPOSE_FILES"
fi
