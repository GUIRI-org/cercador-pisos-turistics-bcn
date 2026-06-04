#!/bin/bash

# Ensure we start with a clean state
unset ENABLE_FRONTEND
unset RUN_FRONTEND
export RUN_FRONTEND="true"  # When undeploying, we need to include all services

source ./infra_common.sh

CMD="${COMPOSE_BINARY} ${COMPOSE_FILES} down"
if [ "$1" = "--purge" ]; then
    CMD="${CMD} -v"
fi

exec $CMD
