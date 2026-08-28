# Infrastructure Configuration

This directory contains Docker Compose configurations and deployment scripts for the Guiripisos project.

## Quick Start (Local Development)

```bash
# 1. Copy and configure environment
cp .env.sample .env
# Edit .env with your local settings

# 2. Start all services
./infra_deploy.sh

# 3. View logs
./infra_logs.sh

# 4. Stop services
./infra_undeploy.sh
```

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │         Docker Network              │
                    │       (guiripisos-network)          │
                    │                                     │
Internet ─────────▶ │  Nginx (:80) ───┬──▶ API (:8000)   │
                    │       │         │                   │
                    │       │         ├──▶ Mage (:6789)   │
                    │       │         │                   │
                    │       ▼         └──▶ Frontend       │
                    │   Static files      (dev only)      │
                    │                                     │
                    │         PostgreSQL (:5432)          │
                    └─────────────────────────────────────┘
```

## Files

### Compose Files
| File                    | Purpose                     |
| ----------------------- | --------------------------- |
| `compose-db.yaml`       | PostgreSQL with PostGIS     |
| `compose-api.yaml`      | FastAPI REST service        |
| `compose-mage.yaml`     | Mage.ai data pipelines      |
| `compose-nginx.yaml`    | Nginx reverse proxy         |
| `compose-next-app.yaml` | Next.js frontend (dev only) |

### Scripts

**Server deployment (CI/CD):**
| Script      | Purpose                                                                  |
| ----------- | ------------------------------------------------------------------------ |
| `deploy.sh` | Full deployment orchestrator: stop → pull → build → start → health check |

**Local development:**
| Script              | Purpose                                          |
| ------------------- | ------------------------------------------------ |
| `infra_common.sh`   | Shared variables (COMPOSE_BINARY, COMPOSE_FILES) |
| `infra_deploy.sh`   | Start containers (`docker compose up`)           |
| `infra_undeploy.sh` | Stop containers (`docker compose down`)          |
| `infra_pull.sh`     | Pull latest images                               |
| `infra_logs.sh`     | View container logs                              |

Note: `deploy.sh` reuses the `infra_*.sh` scripts internally to avoid code duplication.

### Environment Files
| File                      | Purpose                          |
| ------------------------- | -------------------------------- |
| `.env.sample`             | Environment template (committed) |
| `.env`                    | Local overrides (gitignored)     |
| `.env.staging.example`    | Staging config example           |
| `.env.production.example` | Production config example        |

## Deployment Environments

### Local Development
- Port: Any available (default 8888)
- Domains: `*.guiripisos.local` (add to `/etc/hosts`)
- Frontend: Optional Next.js container or static build

### Staging (Server)
- Port: 8001 (80 + project number 01)
- Domain: `stg.guiripisos.danielca.net`
- Path: `/opt/apps/guiripisos/staging/`

### Production (Server)
- Port: 8101 (81 + project number 01)  
- Domain: `guiripisos.danielca.net`
- Path: `/opt/apps/guiripisos/production/`

## CI/CD Deployment

Deployments are automated via GitHub Actions:

- **Push to `main`** → Deploy to staging
- **Push to `production`** → Deploy to production
- **Manual trigger** → Choose environment

See `.github/workflows/deploy.yml` for details.

### Required GitHub Secrets

**Repository level:**
- `SERVER_HOST` - Server IP (78.46.45.253)
- `SERVER_USER` - SSH user (deploy)
- `SERVER_SSH_KEY` - SSH private key
- `SFTP_HOST` - SFTP server
- `SFTP_USER` - SFTP username
- `SFTP_PASSWORD` - SFTP password

**Environment level (staging & production):**
- `DB_PASSWORD` - Database password
- `DEPLOY_PATH` - Full path to deployment directory

## Usage

### Using Makefile (Recommended)

From the project root directory:

```bash
# CI/CD deployment (full sequence: stop → pull → build → start → health check)
make cicd-deploy              # Standard deployment
make cicd-deploy-recreate     # Force recreate all containers
make cicd-deploy-full         # Include frontend container
make cicd-deploy-full-recreate # Frontend + force recreate

# Local development (quick start/stop)
make infra-deploy             # Start backend services
make infra-deploy-full        # Include frontend container
make infra-undeploy           # Stop all containers
make infra-logs-follow        # Stream logs
```

### Using Scripts Directly

From the `infra/` directory:

```bash
# Server deployment
./deploy.sh                   # Full deployment sequence
./deploy.sh --force-recreate  # Force recreate all containers
./deploy.sh --run-frontend    # Include frontend container

# Local development
./infra_deploy.sh             # Start containers
./infra_deploy.sh --run-frontend --force-recreate
./infra_undeploy.sh           # Stop containers
./infra_undeploy.sh --purge   # Stop and remove volumes
```

## Ports Reference

| Service    | Internal Port | Host Port (Local) | Host Port (Staging) | Host Port (Production) |
| ---------- | ------------- | ----------------- | ------------------- | ---------------------- |
| Nginx      | 80            | 8888              | 8001                | 8101                   |
| PostgreSQL | 5432          | 5432              | 5401                | 5501                   |
| API        | 8000          | -                 | -                   | -                      |
| Mage       | 6789          | -                 | -                   | -                      |
| Next.js    | 3000          | -                 | -                   | -                      |

Notes:
- Nginx is proxied by HestiaCP for HTTP/HTTPS access
- PostgreSQL is exposed directly for SQL client connections (DBeaver, psql, etc.)
- Other services communicate only via Docker network

## Database

PostgreSQL with PostGIS extension.

```bash
# Connect to database
docker exec -it guiripisos-pgsql psql -U guiripisos -d guiripisos

# Backup database
docker exec guiripisos-pgsql pg_dump -U guiripisos guiripisos > backup.sql

# Restore database
cat backup.sql | docker exec -i guiripisos-pgsql psql -U guiripisos -d guiripisos
```

## Troubleshooting

### Containers won't start
```bash
# Check logs
docker compose -f compose-db.yaml -f compose-api.yaml -f compose-nginx.yaml logs

# Check if ports are in use
lsof -i :8888
```

### Database connection issues
```bash
# Check if DB is ready
docker exec guiripisos-pgsql pg_isready -U guiripisos

# View DB logs
docker logs guiripisos-pgsql
```

### Nginx 502 errors
```bash
# Check if backend is running
docker exec guiripisos-nginx curl -s http://guiripisos-api:8000/health

# Check nginx config
docker exec guiripisos-nginx nginx -t
```
