# Mark all targets as PHONY (not representing files)
.PHONY: help cicd-deploy cicd-deploy-recreate infra-deploy infra-deploy-frontend infra-deploy-recreate infra-deploy-frontend-recreate infra-undeploy infra-undeploy-purge infra-logs infra-logs-follow api-test api-test-env sparql-test sparql-test-env benchmark-legacy benchmark-legacy-url benchmark-legacy-docker version-bump-patch version-bump-minor version-bump-patch-push version-bump-minor-push

# Help target - displays available commands
help:
	@echo "Available commands:"
	@echo ""
	@echo "  CI/CD Deployment (Server):"
	@echo "    make cicd-deploy                 - Complete deployment: stop → pull → build → start → health check"
	@echo "    make cicd-deploy-recreate        - Complete deployment with force-recreate"
	@echo ""
	@echo "  Infrastructure (Local Dev):"
	@echo "    make infra-deploy                    - Start core infrastructure (DB, Mage, API, Nginx)"
	@echo "    make infra-deploy-frontend           - Start all infrastructure including frontend apps"
	@echo "    make infra-deploy-recreate           - Start core infrastructure with force-recreate"
	@echo "    make infra-deploy-frontend-recreate  - Start all infrastructure with force-recreate"
	@echo "    make infra-undeploy                  - Stop infrastructure"
	@echo "    make infra-undeploy-purge            - Stop infrastructure and remove all volumes"
	@echo "    make infra-logs                      - View infrastructure logs once"
	@echo "    make infra-logs-follow               - View and follow infrastructure logs"
	@echo ""
	@echo "  Versioning:"
	@echo "    make version-bump-patch          - Bump patch version (e.g. 0.1.0 → 0.1.1)"
	@echo "    make version-bump-minor          - Bump minor version (e.g. 0.1.0 → 0.2.0)"
	@echo "    make version-bump-patch-push     - Bump patch version, commit, and push branch/tag"
	@echo "    make version-bump-minor-push     - Bump minor version, commit, and push branch/tag"
	@echo ""
	@echo "  See docs/make-commands.md for full documentation."

# =============================================================================
# CI/CD Deployment targets (used by GitHub Actions on server)
# =============================================================================
cicd-deploy:
	@echo "Running full deployment sequence..."
	cd infra && ./deploy.sh
	@echo "Deployment complete."

cicd-deploy-recreate:
	@echo "Running full deployment with force-recreate..."
	cd infra && ./deploy.sh --force-recreate
	@echo "Deployment complete."

# =============================================================================
# Infrastructure Management targets (local development)
# =============================================================================
infra-deploy:
	@echo "Starting core infrastructure (DB, Mage, API, Nginx)..."
	cd infra && ./infra_deploy.sh
	@echo "Done. Core infrastructure is up and running."

infra-deploy-frontend:
	@echo "Starting full infrastructure including frontend applications..."
	cd infra && ./infra_deploy.sh --run-frontend
	@echo "Done. Full infrastructure is up and running."

infra-deploy-recreate:
	@echo "Starting core infrastructure with force-recreate..."
	cd infra && ./infra_deploy.sh --force-recreate
	@echo "Done. Core infrastructure is up and running."

infra-deploy-frontend-recreate:
	@echo "Starting full infrastructure with force-recreate..."
	cd infra && ./infra_deploy.sh --run-frontend --force-recreate
	@echo "Done. Full infrastructure is up and running."

# Cleanup targets
infra-undeploy:
	@echo "Stopping infrastructure..."
	cd infra && ./infra_undeploy.sh
	@echo "Done. Infrastructure is down."

infra-undeploy-purge:
	@echo "Stopping and purging infrastructure..."
	cd infra && ./infra_undeploy.sh --purge
# 	@echo "Removing Mage local temporary volumes files..."
# 	rm -rf magic/mage_data && rm -rf magic/data
	@echo "Done. Infrastructure is down and all volumes have been removed."

# Log viewing targets
infra-logs:
	@echo "Viewing infrastructure logs..."
	cd infra && ./infra_logs.sh --no-follow
	@echo "Done showing logs."

infra-logs-follow:
	@echo "Following infrastructure logs..."
	cd infra && ./infra_logs.sh
	@echo "Log following stopped."

# Versioning targets
version-bump-patch:
	@./scripts/version_bump.sh patch

version-bump-minor:
	@./scripts/version_bump.sh minor

version-bump-patch-push:
	@./scripts/version_bump.sh patch --push

version-bump-minor-push:
	@./scripts/version_bump.sh minor --push
