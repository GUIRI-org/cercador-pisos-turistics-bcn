# Makefile Commands Reference

This document provides detailed documentation for all Makefile commands available in the project.

## Command Naming Convention

| Prefix    | Purpose                                      | Used By                            |
| --------- | -------------------------------------------- | ---------------------------------- |
| `cicd-*`  | Full deployment sequence for CI/CD pipelines | GitHub Actions, server deployments |
| `infra-*` | Individual infrastructure operations         | Local development, debugging       |

## Quick Reference

```bash
# View all available commands
make help

# Most common workflows
make infra-deploy          # Start local dev environment
make infra-undeploy        # Stop local dev environment
make cicd-deploy           # Full server deployment (CI/CD)
```

---

## CI/CD Deployment Commands

These commands execute a complete deployment sequence intended for CI/CD pipelines and server deployments. They orchestrate multiple steps: stop existing containers → pull latest images → build → start → health check.

### `make cicd-deploy`

Full deployment sequence for production/staging environments.

```bash
make cicd-deploy
```

**Sequence:**
1. Stop existing containers (`infra_undeploy.sh`)
2. Pull latest base images (`infra_pull.sh`)
3. Build and start containers (`infra_deploy.sh`)
4. Run health checks (PostgreSQL ready, Nginx config valid)
5. Display container status

**Use when:**
- Deploying to staging or production server
- Running from GitHub Actions
- You want a clean, repeatable deployment

---

### `make cicd-deploy-recreate`

Full deployment with `--force-recreate` flag to rebuild all containers even if unchanged.

```bash
make cicd-deploy-recreate
```

**Use when:**
- Environment variables have changed
- You suspect container state issues
- After infrastructure configuration changes

---

### `make cicd-deploy-full`

Full deployment including the frontend Next.js container.

```bash
make cicd-deploy-full
```

**Note:** The frontend container is typically only needed for development. In production, static files are deployed via SFTP.

---

### `make cicd-deploy-full-recreate`

Full deployment with frontend container and force-recreate.

```bash
make cicd-deploy-full-recreate
```

---

## Infrastructure Commands

These commands perform individual operations for local development. They're simpler and faster than CI/CD commands since they skip steps like pulling images.

### `make infra-deploy`

Start core infrastructure containers (PostgreSQL, Mage, API, Nginx).

```bash
make infra-deploy
```

**Containers started:**
- `guiripisos-pgsql` — PostgreSQL with PostGIS
- `guiripisos-mage` — Mage.ai data pipelines
- `guiripisos-api` — FastAPI REST service
- `guiripisos-nginx` — Nginx reverse proxy

**Use when:**
- Starting local development
- Containers are already built and you just need to start them

---

### `make infra-deploy-full`

Start all infrastructure including the Next.js frontend container.

```bash
make infra-deploy-full
```

**Additional container:**
- `guiripisos-next` — Next.js frontend (development mode)

---

### `make infra-deploy-recreate`

Start infrastructure with `--force-recreate` to rebuild containers.

```bash
make infra-deploy-recreate
```

---

### `make infra-deploy-full-recreate`

Start all infrastructure including frontend with force-recreate.

```bash
make infra-deploy-full-recreate
```

---

### `make infra-undeploy`

Stop all running containers gracefully.

```bash
make infra-undeploy
```

**Use when:**
- Ending development session
- Before switching branches with different infrastructure

---

### `make infra-undeploy-purge`

Stop containers and **delete all Docker volumes** (including database data).

```bash
make infra-undeploy-purge
```

⚠️ **Warning:** This deletes all data including the PostgreSQL database. Use with caution.

**Use when:**
- Starting completely fresh
- Database schema has changed incompatibly
- Troubleshooting data corruption issues

---

### `make infra-logs`

View container logs (one-time snapshot).

```bash
make infra-logs
```

---

### `make infra-logs-follow`

Stream container logs continuously (Ctrl+C to stop).

```bash
make infra-logs-follow
```

---

## Underlying Scripts

The Makefile commands call shell scripts in the `infra/` directory:

| Script              | Purpose                      | Called By                      |
| ------------------- | ---------------------------- | ------------------------------ |
| `deploy.sh`         | Full deployment orchestrator | `cicd-*` commands              |
| `infra_deploy.sh`   | Start containers             | `infra-deploy*`, `deploy.sh`   |
| `infra_undeploy.sh` | Stop containers              | `infra-undeploy*`, `deploy.sh` |
| `infra_pull.sh`     | Pull latest images           | `deploy.sh`                    |
| `infra_logs.sh`     | View logs                    | `infra-logs*`                  |
| `infra_common.sh`   | Shared variables             | All scripts                    |

**Relationship:**
```
cicd-deploy
    └── deploy.sh
            ├── infra_undeploy.sh
            ├── infra_pull.sh
            └── infra_deploy.sh

infra-deploy
    └── infra_deploy.sh
```

---

## Environment-Specific Usage

### Local Development

```bash
# Start development environment
make infra-deploy

# Work on your code...

# View logs if needed
make infra-logs-follow

# Stop when done
make infra-undeploy
```

### Server Deployment (Manual)

```bash
# SSH to server
ssh deploy@server.danielca.net

# Navigate to project
cd /opt/apps/guiripisos/staging

# Deploy
make cicd-deploy
```

### GitHub Actions (Automated)

The GitHub Actions workflow runs:
```bash
cd /opt/apps/guiripisos/{environment}
git pull origin {branch}
make cicd-deploy
```

---

## Troubleshooting

### Containers won't start

```bash
# Check what's running
docker ps -a

# View detailed logs
make infra-logs-follow

# Try force-recreate
make infra-deploy-recreate
```

### Database issues

```bash
# Connect to database
docker exec -it guiripisos-pgsql psql -U guiripisos -d guiripisos

# Full reset (loses all data!)
make infra-undeploy-purge
make infra-deploy
```

### Port conflicts

```bash
# Check what's using the port
lsof -i :8888

# Stop conflicting service or change NGINX_PORT in .env
```
