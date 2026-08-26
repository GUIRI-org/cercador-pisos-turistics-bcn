# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added
- **Next.js app Docker configuration** for containerized deployment
  - `frontend/next-app/Dockerfile` - Docker image for Next.js development server
  - `infra/compose-next-app.yaml` - Docker Compose service definition for Next.js app
  - Container port configuration (`NEXT_APP_CONTAINER_PORT`) in infrastructure environment
  - Service integration with existing API container via Docker network
- **Environment variable support** for Next.js frontend configuration
  - `frontend/next-app/.env.sample` - Template file for environment configuration
  - `NEXT_PUBLIC_GUIRI_API_BASE` - Configurable API base URL (default: `http://127.0.0.1:9092`)
  - Environment variable documentation in frontend README
- **Infrastructure enhancements** for Next.js deployment
  - Next.js container name configuration (`NEXT_APP_CONTAINER_NAME`)
  - Frontend compose files integrated into infrastructure common script
  - API base URL configuration for containerized environment (`NEXT_APP_GUIRI_API_BASE`)
- **FastAPI REST API** (`api/`) for serving GUIRI Apartaments data to frontend
  - `/api/v1/apartments` - List all apartments with optional filtering by district/neighborhood
  - `/api/v1/apartments/map` - Optimized apartment coordinates for map visualization with `year_from` field
  - `/api/v1/apartments/search` - Address-grouped search with `year_from` field
  - `/api/v1/apartments/districts` - List all districts with `apartments_count`, `total_places`, and yearly `progression`
  - `/api/v1/apartments/neighborhoods` - List all neighborhoods with `apartments_count`, `total_places`, and yearly `progression`
  - `/api/v1/apartments/{n_expedient}` - Get single apartment by case number
  - `/api/v1/health` - Health check endpoint with database connectivity
  - CORS middleware for frontend integration
  - GZip compression for API responses
  - Cache-Control headers (7-day TTL) for static endpoints
  - Dockerized deployment with `compose-api.yaml`
- **API enhancements** for temporal and statistical analysis
  - `Progression` model for tracking yearly changes in apartments and tourist places
  - `year_from` field in search and map endpoints showing minimum year from expedient numbers
  - Yearly progression data in districts/neighborhoods endpoints with per-year breakdowns
- **Bruno API collection** for GUIRI Apartments API endpoints (`api-collection/GUIRI Apartments/`)
  - Apartments map query
  - Search by district
  - Search by neighborhood
  - Search by address
  - Districts list
  - Neighborhoods list
  - localhost environment configuration
- **CSV-based database initialization** approach (replacing dump-based method)
  - `database/01-create-schema.sql` - DDL script for creating schema, tables, and indexes
  - Automatic CSV data loading from `data/interim/hut_comunicacio_opendata.csv`
  - Sequential initialization scripts via Docker `docker-entrypoint-initdb.d/`
- Database coordinate normalization script (`02-normalize-address-coordinates.sql`) to resolve conflicting coordinates for same addresses
- Database schema (DDL) for Barcelona tourist housing data with PostGIS geometry support
- CSV data loader script (`load-habitatges-csv.sql`) for importing habitatges_us_turistic dataset
- Bruno HTTP API collection for OpenData BCN APIs (Cerca territori, Adreces, Illa)
- Observable Framework frontend with geoBCN street address search form (Tipo Vía, Carrer autocomplete, Número)
- Chained tourist housing search in frontend: exact address query (street + number) plus street-only query (type + street)
- Full pagination retrieval for tourist housing endpoint results to display all matches
- Externalized frontend styles into `src/styles.css` with Bootstrap CSS import
- Mage documentation (guidelines and README)
- Infrastructure setup with PostgreSQL, Nginx, and Mage containers
- Next.js frontend enhancements in `frontend/next-app/`
  - Leaflet mini-map in apartment results with support for nearby street markers
  - Street-level result filtering to hide addresses already shown in exact-address results
  - Floor (`pis`) normalization and grouping to a consistent two-digit format (`01`, `02`, `03`, ...)
  - Conditional rendering for "Same street" results only when data exists (or while loading)
  - Custom brand asset added: `public/guiri-gamba.svg`
  - Shared Bootstrap style overrides in `styles/bootstrap.scss`

### Changed
- **API response field renames** for consistency across endpoints
  - Districts endpoint: `apartments` → `apartments_count`
  - Neighborhoods endpoint: `apartments` → `apartments_count`
- **API response enhancements** with additional statistical fields
  - Districts endpoint: Added `total_places` (sum of all tourist places/beds)
  - Neighborhoods endpoint: Added `total_places` (sum of all tourist places/beds)
  - Search and Map endpoints: Added `year_from` (minimum year from expedient numbers)
- **Database schema** (`database/01-create-schema.sql`)
  - Added `DEFAULT 1` to `dataset_id` column in `habitatges_us_turistic` table
- **Database initialization architecture**: Migrated from dump-based to CSV-based approach
  - `infra/compose-db.yaml`: Updated volume mounts to use DDL + CSV files instead of dump file
  - `database/load-habitatges-csv.sql`: Updated CSV path for Docker container compatibility (`/data/hut_comunicacio_opendata.csv`)
  - `database/README.md`: Comprehensive documentation rewrite explaining CSV-based initialization benefits
- Updated `README.md` with API service information and improved quick start guide
- Enhanced infrastructure setup to include FastAPI service in deployment
- `frontend/next-app/app/components/ApartmentResults.tsx`
  - Removed repeated collapsible address header in exact-address mode to avoid duplicated address labels
  - Kept prioritized-result visual differentiation while preserving result summary styles
  - Improved apartment deduplication consistency by normalizing `pis` in grouping keys
- `frontend/next-app/app/page.tsx`
  - Updated street results title copy to "Same street"
  - Refined sticky search panel width/position values for centered 640px layout
- `frontend/next-app/.gitignore`
  - Added exception to allow `.env.sample` to be tracked in version control
- `frontend/next-app/lib/api.ts`
  - Made `GUIRI_API_BASE` read from `NEXT_PUBLIC_GUIRI_API_BASE` environment variable with fallback to default value
- `frontend/next-app/next.config.ts`
  - Added `allowedDevOrigins` for localhost/127.0.0.1 to support Docker containerized development

### Removed
- `database/01-restore-dump.sh` - Shell script for restoring database dumps (replaced by DDL approach)
- `database/guiripisos.sql.gz` - Binary database dump file (replaced by CSV + DDL scripts)
- Old API collection example queries (replaced with standardized OpenData BCN examples)