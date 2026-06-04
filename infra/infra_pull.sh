#!/bin/bash

source ./infra_common.sh

# Initialize with base compose files
compose_files=${BASE_COMPOSE_FILES}

# Check if frontend was enabled during deployment
if [ "$ENABLE_FRONTEND" = "true" ]; then
    compose_files="$compose_files ${FRONTEND_COMPOSE_FILES}"
fi

${COMPOSE_BINARY} ${compose_files} pull
