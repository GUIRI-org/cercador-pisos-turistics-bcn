#!/bin/bash
# =============================================================================
# Server-side Deployment Script
# =============================================================================
# Orchestrates deployment by calling existing infra_* scripts.
# Called by GitHub Actions or manually on the server.
#
# Usage:
#   ./deploy.sh                    # Standard deployment
#   ./deploy.sh --force-recreate   # Force recreate all containers
#   ./deploy.sh --with-frontend    # Include frontend container (dev only)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# -----------------------------------------------------------------------------
# Load environment for logging purposes
# -----------------------------------------------------------------------------
if [ ! -f .env ]; then
    log_error ".env file not found! Copy .env.sample to .env first."
    exit 1
fi

# shellcheck disable=SC1091
source .env

PROJECT_NAME="${GLOBAL_INSTALLATION_APP:-guiripisos}"
DEPLOY_ENV="${GLOBAL_ENV:-staging}"

# -----------------------------------------------------------------------------
# Parse arguments and forward to infra scripts
# -----------------------------------------------------------------------------
DEPLOY_ARGS=""
for arg in "$@"; do
    case "$arg" in
        --force-recreate)
            DEPLOY_ARGS="$DEPLOY_ARGS --force-recreate"
            ;;
        --with-frontend|--run-frontend)
            DEPLOY_ARGS="$DEPLOY_ARGS --run-frontend"
            ;;
    esac
done

# -----------------------------------------------------------------------------
# Deployment sequence
# -----------------------------------------------------------------------------
log_info "Starting deployment: ${PROJECT_NAME} (${DEPLOY_ENV})"

# Step 1: Stop existing containers
log_info "Stopping existing containers..."
./infra_undeploy.sh 2>/dev/null || true

# Step 2: Pull latest images
log_info "Pulling base images..."
./infra_pull.sh 2>/dev/null || log_warn "Some images couldn't be pulled"

# Step 3: Build and start
log_info "Building and starting containers..."
# shellcheck disable=SC2086
if ! ./infra_deploy.sh $DEPLOY_ARGS; then
    log_error "Failed to start containers"
    exit 1
fi

# -----------------------------------------------------------------------------
# Health checks
# -----------------------------------------------------------------------------
log_info "Waiting for services to start..."
sleep 10

# Container names are computed from DOCKER_BASE_NAME
NGINX_CONTAINER="${DOCKER_BASE_NAME}-nginx"
DB_CONTAINER="${DOCKER_BASE_NAME}-pgsql"

if docker exec "$DB_CONTAINER" pg_isready -U "${GLOBAL_DB_USER:-postgres}" &>/dev/null; then
    log_success "PostgreSQL ready"
else
    log_warn "PostgreSQL not ready yet"
fi

if docker exec "$NGINX_CONTAINER" nginx -t &>/dev/null 2>&1; then
    log_success "Nginx config valid"
else
    log_warn "Nginx config check failed"
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
log_success "=========================================="
log_success "Deployment complete!"
log_success "=========================================="
echo ""
log_info "Project: ${PROJECT_NAME}"
log_info "Environment: ${DEPLOY_ENV}"
echo ""

# Source common to get COMPOSE_FILES for status display
export RUN_FRONTEND="${RUN_FRONTEND:-false}"
source ./infra_common.sh
# shellcheck disable=SC2086
$COMPOSE_BINARY $COMPOSE_FILES ps --format "table {{.Name}}\t{{.Status}}"
echo ""
log_info "Logs: ./infra_logs.sh"
