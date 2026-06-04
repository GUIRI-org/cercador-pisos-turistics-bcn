#!/bin/bash

# Ensure we start with a clean state
unset RUN_FRONTEND
unset ENABLE_FRONTEND

options="-d --build"
export RUN_FRONTEND="false"

# Process all arguments
for arg in "$@"; do
    case "$arg" in
        --force-recreate)
            options="$options --force-recreate"
            ;;
        --run-frontend)
            export RUN_FRONTEND="true"
            ;;
    esac
done

# Export the frontend status for nginx configuration (if needed)
export ENABLE_FRONTEND=${RUN_FRONTEND}

source ./infra_common.sh

${COMPOSE_BINARY} ${COMPOSE_FILES} up $options
