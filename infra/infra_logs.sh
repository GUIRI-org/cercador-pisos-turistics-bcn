#!/bin/bash

source ./infra_common.sh

# Initialize with base compose files
compose_files=${BASE_COMPOSE_FILES}

# Check if frontend was enabled during deployment
if [ "$ENABLE_FRONTEND" = "true" ]; then
    compose_files="$compose_files ${FRONTEND_COMPOSE_FILES}"
fi

# Check if --no-follow flag is passed
if [ "$1" = "--no-follow" ]; then
    ${COMPOSE_BINARY} ${compose_files} logs
else
    ${COMPOSE_BINARY} ${compose_files} logs -f
fi
